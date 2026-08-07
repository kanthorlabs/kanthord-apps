import 'package:flutter/material.dart';

import 'kd_button.dart';

final class KDInputField extends StatefulWidget {
  const KDInputField({
    required this.label,
    this.initialValue,
    this.controller,
    this.hint,
    this.helper,
    this.error,
    this.isObscured = false,
    this.isEnabled = true,
    this.keyboardType,
    this.onChanged,
    this.onSubmitted,
    super.key,
  }) : assert(
         controller == null || initialValue == null,
         'Pass a controller or an initialValue, never both',
       );

  final String label;
  final String? initialValue;
  final TextEditingController? controller;
  final String? hint;
  final String? helper;
  final String? error;
  final bool isObscured;
  final bool isEnabled;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<KDInputField> createState() => _KDInputFieldState();
}

class _KDInputFieldState extends State<KDInputField> {
  TextEditingController? _internalController;
  bool _isRevealed = false;

  @override
  void initState() {
    super.initState();
    if (widget.controller == null) {
      _internalController = TextEditingController(text: widget.initialValue);
    }
  }

  @override
  void dispose() {
    _internalController?.dispose();
    super.dispose();
  }

  void _toggleReveal() => setState(() => _isRevealed = !_isRevealed);

  Widget _buildRevealControl() {
    return KDButton.icon(
      icon: _isRevealed ? Icons.visibility_off_outlined : Icons.visibility_outlined,
      tooltip: _isRevealed ? 'Hide the value' : 'Show the value',
      isEnabled: widget.isEnabled,
      onPressed: _toggleReveal,
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller ?? _internalController,
      enabled: widget.isEnabled,
      obscureText: widget.isObscured && !_isRevealed,
      keyboardType: widget.keyboardType,
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        helperText: widget.helper,
        errorText: widget.error,
        suffixIcon: widget.isObscured ? _buildRevealControl() : null,
      ),
    );
  }
}
