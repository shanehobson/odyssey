import { FieldError } from "@/shared/components/FieldError/FieldError";
import {
  ConfirmEmailFormData,
  confirmEmailSchema,
} from "@/features/auth/validations/auth.schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSX, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface LocationState {
  email?: string;
  message?: string;
  autoSignIn?: boolean;
}

export default function ConfirmEmailPage(): JSX.Element {
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const { confirmEmail } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<ConfirmEmailFormData>({
    resolver: zodResolver(confirmEmailSchema),
    mode: "onBlur",
    defaultValues: {
      email: state.email || "",
    },
  });

  useEffect(() => {
    if (state.email) {
      setValue("email", state.email);
    }
  }, [state.email, setValue]);

  const onSubmit = async (data: ConfirmEmailFormData): Promise<void> => {
    setError("");
    try {
      await confirmEmail({
        email: data.email,
        confirmationCode: data.confirmationCode,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    }
  };

  if (success) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-inverse text-center mb-6">
          Email Confirmed!
        </h2>
        <div className="text-center space-y-4">
          <p className="text-inverse">
            Your email has been confirmed successfully.
          </p>
          {state.autoSignIn ? (
            <p className="text-inverse">Signing you in automatically...</p>
          ) : (
            <Link
              to="/login"
              className="text-brand-green cursor-pointer font-medium"
            >
              Sign in now
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-inverse text-center mb-6 lg:hidden">
        Confirm Your Email
      </h2>
      {state.message && (
        <p className="text-center text-inverse mb-4">{state.message}</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
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

        <div>
          <div className="flex justify-center">
            <input
              id="confirmationCode"
              type="text"
              {...register("confirmationCode")}
              className={`form-input max-w-[320px] ${
                errors.confirmationCode ? "form-input-invalid" : ""
              }`}
              placeholder="Enter the 6-digit code from your email"
              disabled={isSubmitting}
            />
          </div>
          {errors.confirmationCode && (
            <div className="flex justify-center">
              <div className="max-w-[320px] w-full">
                <FieldError error={errors.confirmationCode.message} />
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
          disabled={isSubmitting}
          className="btn btn-primary w-full flex justify-center"
        >
          {isSubmitting ? "Confirming..." : "Confirm Email"}
        </button>
      </form>

      <div className="text-center mt-6">
        <Link
          to="/login"
          className="text-brand-green cursor-pointer text-sm font-medium"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
