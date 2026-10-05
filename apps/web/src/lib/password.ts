/** The API's password rule (8-128 characters), worded for a form field. */
export function passwordError(password: string): string | undefined {
  if (password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  if (password.length > 128) return "Mật khẩu không được quá 128 ký tự.";
}
