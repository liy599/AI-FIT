import { useState, type InputHTMLAttributes } from 'react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordField({ className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const inputClassName = ['auth-password-input', className].filter(Boolean).join(' ')

  return (
    <div className="auth-password-field">
      <input {...props} className={inputClassName} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="auth-password-toggle"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((value) => !value)}
      >
        <i className={visible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} aria-hidden="true" />
      </button>
    </div>
  )
}
