import { JSX, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { authService } from "../services/auth.service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordFormData } from "@/features/auth/validations/auth.schemas";
import { FieldError } from "@/shared/components/FieldError/FieldError";

export default function ResetPasswordPage(): JSX.Element {
  const location = useLocation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setValue
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched", // Show errors on blur, but track validity in real-time
    defaultValues: {
      email: location.state?.email || "",
    }
  });

  useEffect(() => {
    // Get email from navigation state if coming from forgot password page
    if (location.state?.email) {
      setValue('email', location.state.email);
    }
  }, [location.state, setValue]);

  const onSubmit = async (data: ResetPasswordFormData): Promise<void> => {
    setError("");
    try {
      await authService.resetPassword({
        email: data.email,
        code: data.code,
        newPassword: data.newPassword
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-inverse text-center mb-6">
          Password Reset Successfully
        </h2>
        <div className="bg-overlay-light border border-inverse rounded-md p-4 mb-6">
          <p className="text-inverse text-sm">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
        </div>
        <Link
          to="/login"
          className="btn btn-secondary w-auth-button mx-auto flex justify-center"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-inverse text-center mb-6">
        Set New Password
      </h2>
      <p className="text-inverse text-center mb-6">
        Enter the reset code from your email and choose a new password.
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

        <div>
          <div className="flex justify-center">
            <input
              id="code"
              type="text"
              {...register("code")}
              className={`form-input max-w-[320px] ${errors.code ? 'form-input-invalid' : ''}`}
              placeholder="Reset Code"
              disabled={isSubmitting}
            />
          </div>
          {errors.code && (
            <div className="flex justify-center">
              <div className="max-w-[320px] w-full">
                <FieldError error={errors.code.message} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-center">
            <input
              id="newPassword"
              type="password"
              {...register("newPassword")}
              className={`form-input max-w-[320px] ${errors.newPassword ? 'form-input-invalid' : ''}`}
              placeholder="New Password"
              disabled={isSubmitting}
            />
          </div>
          {errors.newPassword && (
            <div className="flex justify-center">
              <div className="max-w-[320px] w-full">
                <FieldError error={errors.newPassword.message} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-center">
            <input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              className={`form-input max-w-[320px] ${errors.confirmPassword ? 'form-input-invalid' : ''}`}
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
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>

        <div className="text-center font-ui text-ui text-inverse">
          Need a new code?{" "}
          <Link
            to="/forgot-password"
            className="text-brand-green cursor-pointer"
          >
            Request new code
          </Link>
        </div>
      </form>
    </div>
  );
}
