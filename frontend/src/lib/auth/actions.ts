/**
 * Standalone mock auth actions for UI prototyping and design.
 * Strictly no backend or database dependencies.
 */

export async function signIn(email: string, _password?: string) {
  // Simulate successful login; returns undefined so client treats as success
  return null;
}

export async function signUp(email: string, _password?: string) {
  // Simulate successful signup message
  return { message: "Account created! You can now log in." };
}

export async function forgotPassword(email: string) {
  // Simulate password reset email notification
  return { message: "Password reset link sent to your email." };
}

export async function signOut() {
  // Simulate sign out
  return null;
}
