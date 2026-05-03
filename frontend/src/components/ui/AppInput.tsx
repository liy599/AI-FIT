import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  as?: 'input'
}

type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  as: 'textarea'
}

type Props = AppInputProps | AppTextareaProps

export default function AppInput(props: Props) {
  if (props.as === 'textarea') {
    const { as, className, ...rest } = props
    return <textarea {...rest} className={['app-input', 'app-input--textarea', className].filter(Boolean).join(' ')} />
  }

  const { className, ...rest } = props
  return <input {...rest} className={['app-input', className].filter(Boolean).join(' ')} />
}

