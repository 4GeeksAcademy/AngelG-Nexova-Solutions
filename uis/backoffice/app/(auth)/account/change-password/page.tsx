import { redirect } from "next/navigation";

export default function ChangePasswordPage() {
  return redirect("/account/profile");
}
