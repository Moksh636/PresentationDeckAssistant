interface ToggleFieldProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: ToggleFieldProps) {
  return (
    <label className="toggle-field">
      <div className="toggle-field__copy">
        <span>{label}</span>
        <small>{description}</small>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-field__track" aria-hidden="true"></span>
    </label>
  )
}
