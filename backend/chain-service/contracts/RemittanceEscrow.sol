// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RemittanceEscrow
 * @notice Holds stablecoin per transferId while a cross-border remittance
 *         is in-flight. Each transferId maps to exactly one lifecycle:
 *         NONE -> LOCKED -> RELEASED | REFUNDED.
 *
 * SECURITY:
 * - ReentrancyGuard: prevents re-entrant calls on release/refund.
 * - AccessControl: only OPERATOR_ROLE can release or refund.
 * - Idempotency: a transferId can only be locked once (reverts on re-lock).
 * - State machine enforced on-chain — illegal transitions revert.
 */
contract RemittanceEscrow is AccessControl, ReentrancyGuard {
    // --- Roles ---
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // --- State machine ---
    enum TransferState { NONE, LOCKED, RELEASED, REFUNDED }

    struct EscrowRecord {
        address sender;         // Custodial wallet that locked funds
        address receiver;       // Target custodial wallet (set on lock; may be updated)
        uint256 amount;         // Token units locked
        TransferState state;
    }

    // transferId (string) -> EscrowRecord
    mapping(bytes32 => EscrowRecord) public escrows;

    IERC20 public immutable token;

    // --- Events ---
    event Locked(
        bytes32 indexed transferKey,
        string  transferId,
        address indexed sender,
        address indexed receiver,
        uint256 amount
    );
    event Released(
        bytes32 indexed transferKey,
        string  transferId,
        address indexed receiver,
        uint256 amount
    );
    event Refunded(
        bytes32 indexed transferKey,
        string  transferId,
        address indexed sender,
        uint256 amount
    );

    constructor(address admin, address tokenAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        token = IERC20(tokenAddress);
    }

    // ------------------------------------------------------------------ //
    //  Public view helpers
    // ------------------------------------------------------------------ //

    function getKey(string calldata transferId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(transferId));
    }

    function getState(string calldata transferId) external view returns (TransferState) {
        return escrows[getKey(transferId)].state;
    }

    // ------------------------------------------------------------------ //
    //  Core operations
    // ------------------------------------------------------------------ //

    /**
     * @notice Locks `amount` tokens from `sender` into escrow for `transferId`.
     * @dev    The sender must have approved this contract for at least `amount`.
     *         Reverts if transferId is already used (on-chain idempotency).
     */
    function lock(
        string calldata transferId,
        address sender,
        address receiver,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        bytes32 key = getKey(transferId);
        require(escrows[key].state == TransferState.NONE, "Escrow: already locked");
        require(amount > 0, "Escrow: zero amount");

        // Pull tokens from sender into this contract
        // Operator manages allowances for custodial wallets
        bool ok = token.transferFrom(sender, address(this), amount);
        require(ok, "Escrow: token transfer failed");

        escrows[key] = EscrowRecord({
            sender:   sender,
            receiver: receiver,
            amount:   amount,
            state:    TransferState.LOCKED
        });

        emit Locked(key, transferId, sender, receiver, amount);
    }

    /**
     * @notice Releases locked funds to the receiver (payout step).
     * @dev    Only OPERATOR_ROLE; reverts if not in LOCKED state.
     */
    function release(
        string calldata transferId
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        bytes32 key = getKey(transferId);
        EscrowRecord storage rec = escrows[key];
        require(rec.state == TransferState.LOCKED, "Escrow: not locked");

        rec.state = TransferState.RELEASED;
        bool ok = token.transfer(rec.receiver, rec.amount);
        require(ok, "Escrow: release transfer failed");

        emit Released(key, transferId, rec.receiver, rec.amount);
    }

    /**
     * @notice Refunds locked funds back to the original sender (failure path).
     * @dev    Only OPERATOR_ROLE; reverts if not in LOCKED state.
     */
    function refund(
        string calldata transferId
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        bytes32 key = getKey(transferId);
        EscrowRecord storage rec = escrows[key];
        require(rec.state == TransferState.LOCKED, "Escrow: not locked");

        rec.state = TransferState.REFUNDED;
        bool ok = token.transfer(rec.sender, rec.amount);
        require(ok, "Escrow: refund transfer failed");

        emit Refunded(key, transferId, rec.sender, rec.amount);
    }
}
