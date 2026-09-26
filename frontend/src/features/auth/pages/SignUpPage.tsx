import { JSX } from "react";
import { SignUpForm } from "../components/SignUpForm/SignUpForm";

export default function SignUpPage(): JSX.Element {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold text-inverse text-center mb-6 lg:hidden">Create Account</h2>
      <SignUpForm className="flex-1" />
    </div>
  );
}
