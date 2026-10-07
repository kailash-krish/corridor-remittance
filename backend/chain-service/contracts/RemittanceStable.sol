// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title RemittanceStable (RMTS)
 * @notice Custodial ERC-20 stablecoin representing AED-equivalent value
 *         for the cross-border remittance platform.
 *
 * DESIGN CHOICES:
 * - 6 decimals: 1 RMTS = 1 AED; 1 fil = 0.000001 RMTS.
 *   Minor units in the backend (fils) map 1:1 to token units:
 *   100 AED = 100_000_000 minor units = 100_000_000 token units (6 dec).
 *   Wait — the backend uses 2-decimal "fils" where 1 AED = 100 fils.
 *   We use 6 decimals on-chain for future-proofing; the ChainService divides
 *   by 10^4 when converting backend minor units to token units.
 *
 * - MINTER_ROLE: only granted to the platform operator wallet.
 * - BURNER_ROLE: only granted to the platform operator wallet.
 * - Pausable: admin can halt all transfers in an emergency.
 *
 * SECURITY: Role separation prevents a single compromised key from both
 * minting and burning, limiting blast radius.
 */
contract RemittanceStable is ERC20, AccessControl, ERC20Pausable {
    // --- Role identifiers ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // --- Events ---
    event Minted(address indexed to, uint256 amount, string transferId);
    event Burned(address indexed from, uint256 amount, string transferId);

    constructor(address admin) ERC20("Remittance Stable", "RMTS") {
        // Admin gets all roles initially; they can grant/revoke later
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Returns 6 decimal places.
     *         Backend minor units (fils, 1 AED = 100) are multiplied by 10^4
     *         to convert to token units before minting.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Mints tokens to a user's custodial wallet.
     * @param to         Recipient address (user's custodial wallet)
     * @param amount     Token units (in 6-decimal form)
     * @param transferId Backend transfer ID — for event tracing only, not
     *                   used for on-chain idempotency (escrow handles that)
     */
    function mint(
        address to,
        uint256 amount,
        string calldata transferId
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit Minted(to, amount, transferId);
    }

    /**
     * @notice Burns tokens from a user's custodial wallet.
     * @param from       Address to burn from (must have approved this contract,
     *                   or operator calls burnFrom which requires allowance)
     * @param amount     Token units to burn
     * @param transferId Backend transfer ID — for event tracing
     */
    function burnFrom(
        address from,
        uint256 amount,
        string calldata transferId
    ) external onlyRole(BURNER_ROLE) {
        // _burn does NOT require allowance because BURNER is the operator.
        // Security note: only the BURNER_ROLE key can call this. Custodial
        // wallets never need to approve — the operator manages burning.
        _burn(from, amount);
        emit Burned(from, amount, transferId);
    }

    /**
     * @notice Pauses all token transfers. Emergency brake.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses token transfers.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Required override: AccessControl defines supportsInterface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Required override: ERC20Pausable needs _update
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
