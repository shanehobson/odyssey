import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { FieldError } from "@/shared/components/FieldError/FieldError";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import {
  SignInFormData,
  signInSchema,
} from "@/features/auth/validations/auth.schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSX, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

export function SignInForm(): JSX.Element {
  const [error, setError] = useState("");
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched", // Show errors on blur, but track validity in real-time
  });

  const onSubmit = async (data: SignInFormData): Promise<void> => {
    setError("");
    try {
      await signIn(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Incorrect username or password."
      );
    }
  };

  return (
    <div className={`w-full max-w-md flex flex-col h-full`}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col h-full"
        autoComplete="on"
      >
        {/* Form inputs and login button grouped together */}
        <div className="mt-12">
          <div className="mb-4">
            <div className="flex justify-center">
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className={`form-input max-w-[320px] ${
                  errors.email ? "form-input-invalid" : ""
                }`}
                placeholder="Email"
                disabled={isSubmitting}
              />
            </div>
            {errors.email && (
              <div className="flex justify-center">
                <div className="max-w-[320px] w-full">
                  <FieldError error={errors.email.message} />
                </div>
              </div>
            )}
          </div>

          <div className="mb-2">
            <div className="flex justify-center">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className={`form-input max-w-[320px] ${
                  errors.password ? "form-input-invalid" : ""
                }`}
                placeholder="Password"
                disabled={isSubmitting}
              />
            </div>
            {errors.password && (
              <div className="flex justify-center">
                <div className="max-w-[320px] w-full">
                  <FieldError error={errors.password.message} />
                </div>
              </div>
            )}
          </div>

          {error && (
            <>
              <ErrorMessage error={error} />
              <div className="text-center font-ui text-ui text-inverse mb-8 mt-4">
                Forgot your password?{" "}
                <Link
                  to="/forgot-password"
                  className="text-brand-green cursor-pointer"
                >
                  Reset it here
                </Link>
              </div>
            </>
          )}

          {/* Login button near form inputs */}
          <div className="flex justify-center mt-6">
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={`btn ${
                isSubmitting ? "btn-primary" : "btn-secondary"
              } w-auth-button disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? "Signing In..." : "Log In"}
            </button>
          </div>
        </div>

        {/* Spacer to push signup text to bottom */}
        <div className="flex-grow"></div>

        {/* Sign up text at bottom */}
        <div className="text-center font-ui text-ui text-inverse mb-8">
          Don't have an account?{" "}
          <Link to="/signup" className="text-brand-green cursor-pointer">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
