import { ErrorMessage } from "@/shared/components/ErrorMessage/ErrorMessage";
import { FieldError } from "@/shared/components/FieldError/FieldError";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import {
  SignUpFormData,
  signUpSchema,
} from "@/features/auth/validations/auth.schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSX, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

interface SignUpFormProps {
  className?: string;
}

export function SignUpForm({ className = "" }: SignUpFormProps): JSX.Element {
  const [error, setError] = useState("");
  const { signUp } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched", // Show errors on blur, but track validity in real-time
  });

  const onSubmit = async (data: SignUpFormData): Promise<void> => {
    setError("");
    try {
      await signUp({
        email: data.email,
        password: data.password,
        name: data.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  return (
    <div className={`w-full max-w-md flex flex-col h-full ${className}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="mt-12 lg:mt-4">
          <div className="mb-4">
            <div className="flex justify-center">
              <input
                id="name"
                type="text"
                {...register("name")}
                className={`form-input max-w-[320px] ${
                  errors.name ? "form-input-invalid" : ""
                }`}
                placeholder="Name"
                disabled={isSubmitting}
              />
            </div>
            {errors.name && (
              <div className="flex justify-center">
                <div className="max-w-[320px] w-full">
                  <FieldError error={errors.name.message} />
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex justify-center">
              <input
                id="email"
                type="email"
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

          <div className="mb-4">
            <div className="flex justify-center">
              <input
                id="password"
                type="password"
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

          <div className="mb-2">
            <div className="flex justify-center">
              <input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                className={`form-input max-w-[320px] ${
                  errors.confirmPassword ? "form-input-invalid" : ""
                }`}
                placeholder="Confirm Password"
                disabled={isSubmitting}
              />
            </div>
            {errors.confirmPassword && (
              <div className="flex justify-center">
                <div className="max-w-[320px] w-full">
                  <FieldError error={errors.confirmPassword.message} />
                </div>
              </div>
            )}
          </div>

          {error && <ErrorMessage error={error} />}

          <div className="flex justify-center mt-6">
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={`btn ${
                isSubmitting ? "btn-primary" : "btn-secondary"
              } w-auth-button disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? "Creating Account..." : "Sign Up"}
            </button>
          </div>
        </div>

        <div className="flex-grow"></div>

        <div className="text-center font-ui text-ui text-inverse mb-8">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-green cursor-pointer">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
