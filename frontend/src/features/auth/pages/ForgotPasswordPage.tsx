import { JSX, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordFormData } from "@/features/auth/validations/auth.schemas";
import { FieldError } from "@/shared/components/FieldError/FieldError";

export default function ForgotPasswordPage(): JSX.Element {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    getValues
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched", // Show errors on blur, but track validity in real-time
  });

  const onSubmit = async (data: ForgotPasswordFormData): Promise<void> => {
    setError("");
    try {
      await authService.forgotPassword(data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code");
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-inverse text-center mb-6">
          Check Your Email
        </h2>
        <div className="bg-overlay-light border border-inverse rounded-md p-4 mb-6">
          <p className="text-inverse text-sm">
            We've sent a password reset code to <strong>{getValues('email')}</strong>. 
            Please check your email and enter the code on the next screen.
          </p>
        </div>
        <button
          onClick={() => navigate('/reset-password', { state: { email: getValues('email') } })}
          className="btn btn-secondary w-auth-button mx-auto flex justify-center"
        >
          Enter Reset Code
        </button>
        <div className="mt-4 text-center text-sm text-inverse">
          Didn't receive the code?{" "}
          <button
            onClick={() => {
              setSuccess(false);
              setError("");
            }}
            className="text-brand-green cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-inverse text-center mb-6">
        Reset Your Password
      </h2>
      <p className="text-inverse text-center mb-6">
        Enter your email address and we'll send you a code to reset your password.
      </p>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <div className="flex justify-center">
            <input
              id="email"
              type="email"
              {...register("email")}
              className={`form-input max-w-[320px] ${errors.email ? 'form-input-invalid' : ''}`}
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

        {error && (
          <div className="text-accent-danger text-sm" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className={`btn ${isSubmitting ? 'btn-primary' : 'btn-secondary'} w-auth-button mx-auto flex justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? "Sending..." : "Send Reset Code"}
        </button>

        <div className="text-center font-ui text-ui text-inverse">
          Remember your password?{" "}
          <Link
            to="/login"
            className="text-brand-green cursor-pointer"
          >
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
