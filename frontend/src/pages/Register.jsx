/**
 * REGISTER PAGE
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Pen } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerField, handleSubmit, watch, formState: { errors } } = useForm();

  const { register, isLoading } = useAuthStore();

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const password = watch('password');

  const onSubmit = async (data) => {
    const result = await register(
      data.firstName,
      data.lastName,
      data.email,
      data.password
    );

    if (result.success) {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-wrapper">

      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1 }}>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 48
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                background: 'var(--accent)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Pen size={20} color="#fff" />
            </div>

            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'var(--font-display)'
              }}
            >
              eSign
            </span>
          </div>

          <h1
            style={{
              fontSize: 44,
              color: '#fff',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.15,
              marginBottom: 16
            }}
          >
            Create your<br />
            <em>free account</em>
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 16,
              maxWidth: 380,
              lineHeight: 1.7
            }}
          >
            Start signing, sending and managing documents securely in minutes.
          </p>

          <div style={{ marginTop: 48, display: 'flex', gap: 32 }}>
            {[
              ['100%', 'Secure'],
              ['24/7', 'Cloud Access'],
              ['Free', 'Getting Started']
            ].map(([val, label]) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#fff'
                  }}
                >
                  {val}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    marginTop: 2
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-box">

          <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 6
            }}
          >
            Create account
          </h2>

          <p
            style={{
              color: 'var(--text-2)',
              marginBottom: 32,
              fontSize: 14
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--primary)',
                fontWeight: 600
              }}
            >
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)}>

            {/* First Name */}
            <div className="form-group">
              <label className="form-label">First Name</label>

              <input
                className={`form-input ${errors.firstName ? 'error' : ''}`}
                type="text"
                placeholder="John"
                {...registerField('firstName', {
                  required: 'First name is required'
                })}
              />

              {errors.firstName && (
                <span className="form-error">
                  {errors.firstName.message}
                </span>
              )}
            </div>

            {/* Last Name */}
            <div className="form-group">
              <label className="form-label">Last Name</label>

              <input
                className={`form-input ${errors.lastName ? 'error' : ''}`}
                type="text"
                placeholder="Doe"
                {...registerField('lastName', {
                  required: 'Last name is required'
                })}
              />

              {errors.lastName && (
                <span className="form-error">
                  {errors.lastName.message}
                </span>
              )}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email address</label>

              <input
                className={`form-input ${errors.email ? 'error' : ''}`}
                type="email"
                placeholder="you@example.com"
                {...registerField('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: 'Invalid email address'
                  }
                })}
              />

              {errors.email && (
                <span className="form-error">
                  {errors.email.message}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>

              <div style={{ position: 'relative' }}>
                <input
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                  {...registerField('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                />

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer'
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {errors.password && (
                <span className="form-error">
                  {errors.password.message}
                </span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label">Confirm Password</label>

              <div style={{ position: 'relative' }}>
                <input
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  type={showConfirmPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                  {...registerField('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'Passwords do not match'
                  })}
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer'
                  }}
                >
                  {showConfirmPass ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {errors.confirmPassword && (
                <span className="form-error">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 8 }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

          </form>

        </div>
      </div>
    </div>
  );
}