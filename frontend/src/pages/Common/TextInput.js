import React from "react";

import TextField from "@material-ui/core/TextField";

const styles = {
  textField: {
    width: "45%",
    paddingRight: 20
  }
};

const TextInput = ({
  label,
  helperText,
  value,
  onChange,
  onBlur,
  onFocus,
  pattern,
  multiline = false,
  type = "text",
  disabled = false,
  id
}) => (
  <TextField
    label={label}
    onFocus={onFocus}
    helperText={helperText}
    multiline={multiline}
    style={styles.textField}
    disabled={disabled}
    value={value}
    id={id}
    onChange={event => onChange(event.target.value)}
    onBlur={onBlur}
    pattern={pattern}
  />
);

export default TextInput;
