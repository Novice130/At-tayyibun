import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_exception.dart';
import '../core/phone.dart';
import '../core/constants.dart';
import '../providers.dart';
import '../widgets/avatar_grid.dart';

/// Account creation.
///
/// The server enforces email verification, so this deliberately ends on a
/// "check your email" screen rather than signing the user in.
///
/// Two steps, mirroring the website: details, then an avatar. The avatar step
/// asks for gender only to pick the right preset set — the profile wizard
/// still collects gender properly, since better-auth accepts only `phone`,
/// `termsAcceptedAt` and `image` as extra fields at sign-up. Without this step
/// every mobile-created account fell back to the initial-letter placeholder,
/// because real photos are never uploaded anywhere in this product.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  bool _avatarStep = false;
  bool _termsAccepted = false;
  String? _gender;
  String? _avatar;
  String? _error;

  @override
  void initState() {
    super.initState();
    _phone.text = '+1 ';
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  /// Details step. Everything is validated here so the avatar step cannot
  /// strand the user on a failure that belongs to a field they can no longer
  /// see.
  void _continue() {
    if (!_formKey.currentState!.validate() || _loading) return;
    if (!_termsAccepted) {
      setState(() => _error =
          'Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (toE164(_phone.text) == null) {
      setState(() => _error = 'Please enter a valid phone number, including the country code.');
      return;
    }
    setState(() {
      _error = null;
      _avatarStep = true;
    });
  }

  Future<void> _submit() async {
    if (_loading) return;
    final phone = toE164(_phone.text);
    if (phone == null) {
      setState(() {
        _avatarStep = false;
        _error = 'Please enter a valid phone number, including the country code.';
      });
      return;
    }
    if (_avatar == null) {
      setState(() => _error = 'Please choose an avatar.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ref.read(authRepositoryProvider).signUp(
            email: _email.text.trim(),
            password: _password.text,
            name: _name.text.trim(),
            image: _avatar,
            termsAcceptedAt: DateTime.now(),
          );
      if (mounted) context.go('/verify-phone');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        // The failure is always about a details-step field (a duplicate
        // email), so send them back to where it can be corrected.
        _avatarStep = false;
        _error = RegExp('duplicate|unique', caseSensitive: false)
                .hasMatch(e.message)
            ? 'That email address is already registered.'
            : e.message;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_avatarStep) return _buildAvatarStep(theme);

    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: theme.colorScheme.error.withValues(alpha: 0.3)),
                        ),
                        child: Text(_error!,
                            style: TextStyle(color: theme.colorScheme.error)),
                      ),
                      const SizedBox(height: 16),
                    ],
                    TextFormField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.givenName],
                      decoration: const InputDecoration(
                        labelText: 'First name',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (v) => (v == null || v.trim().length < 2)
                          ? 'Enter your first name'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      onChanged: (val) {
                        final formatted = formatPhoneInput(val);
                        if (formatted != val) {
                          _phone.value = TextEditingValue(
                            text: formatted,
                            selection: TextSelection.collapsed(offset: formatted.length),
                          );
                        }
                      },
                      decoration: const InputDecoration(
                        labelText: 'Phone number',
                        hintText: '+1 555 123 4567',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty || v.trim() == '+1')
                          ? 'Phone number is required'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      autofillHints: const [AutofillHints.newPassword],
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 8)
                          ? 'Use at least 8 characters'
                          : null,
                    ),
                    const SizedBox(height: 24),
                    // EULA — Guideline 1.2 wants an explicit agreement with
                    // zero tolerance for objectionable content. The button
                    // stays disabled until this is ticked.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _termsAccepted,
                          onChanged: _loading
                              ? null
                              : (v) => setState(() => _termsAccepted = v ?? false),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text.rich(
                              TextSpan(
                                style: theme.textTheme.bodySmall,
                                children: [
                                  const TextSpan(
                                      text:
                                          'I agree to the '),
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.baseline,
                                    baseline: TextBaseline.alphabetic,
                                    child: InkWell(
                                      onTap: () => launchUrl(
                                          Uri.parse('$kBaseUrl/terms'),
                                          mode: LaunchMode.externalApplication),
                                      child: Text(
                                        'Terms of Service',
                                        style: TextStyle(
                                          color: theme.colorScheme.primary,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const TextSpan(text: ' and '),
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.baseline,
                                    baseline: TextBaseline.alphabetic,
                                    child: InkWell(
                                      onTap: () => launchUrl(
                                          Uri.parse('$kBaseUrl/privacy'),
                                          mode: LaunchMode.externalApplication),
                                      child: Text(
                                        'Privacy Policy',
                                        style: TextStyle(
                                          color: theme.colorScheme.primary,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const TextSpan(
                                      text:
                                          ', and I understand that At-Tayyibun '
                                          'has zero tolerance for objectionable '
                                          'content or abusive behaviour.'),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loading ? null : _continue,
                      child: const Text('Next: Choose Avatar'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
  /// Step 2 — gender then avatar. Gender is asked here purely to pick the
  /// preset set; it is re-collected (and actually persisted) by the profile
  /// wizard, which owns `profiles.gender`.
  Widget _buildAvatarStep(ThemeData theme) {
    final avatars = _gender == null ? const <String>[] : presetAvatars(_gender!);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose Avatar'),
        leading: BackButton(
          onPressed: _loading ? null : () => setState(() => _avatarStep = false),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.error.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: theme.colorScheme.error
                                    .withValues(alpha: 0.3)),
                          ),
                          child: Text(_error!,
                              style: TextStyle(color: theme.colorScheme.error)),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Text(
                        'Pick a cartoon avatar for the profile. Real photos are '
                        'never displayed publicly.',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 16),
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'MALE', label: Text('Brother')),
                          ButtonSegment(value: 'FEMALE', label: Text('Sister')),
                        ],
                        emptySelectionAllowed: true,
                        selected: _gender == null ? {} : {_gender!},
                        onSelectionChanged: _loading
                            ? null
                            : (s) => setState(() {
                                  _gender = s.isEmpty ? null : s.first;
                                  // The two sets are disjoint, so a stale pick
                                  // would submit an avatar that is not in the
                                  // grid on screen.
                                  _avatar = null;
                                }),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _gender == null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'Select who this profile is for to see the avatars.',
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface
                                    .withValues(alpha: 0.7),
                              ),
                            ),
                          ),
                        )
                      : AvatarGrid(
                          avatars: avatars,
                          selected: _avatar,
                          onSelect: _loading
                              ? null
                              : (url) => setState(() => _avatar = url),
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                  child: FilledButton(
                    onPressed:
                        (_loading || _avatar == null) ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Create Account'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
