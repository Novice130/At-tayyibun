import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_exception.dart';
import '../core/phone.dart';
import '../providers.dart';

/// Phone verification, used for both entry points:
///   [attachToSession] false — signing in or signing up by phone
///   [attachToSession] true  — the gate for an email/Google account
///
/// Firebase delivers and checks the SMS code; the resulting ID token is what
/// reaches better-auth, which mints the session cookie the rest of the app uses.
class VerifyPhoneScreen extends ConsumerStatefulWidget {
  const VerifyPhoneScreen({super.key, this.attachToSession = true});

  final bool attachToSession;

  @override
  ConsumerState<VerifyPhoneScreen> createState() => _VerifyPhoneScreenState();
}

class _VerifyPhoneScreenState extends ConsumerState<VerifyPhoneScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();

  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  String? _e164;
  String? _verificationId;

  @override
  void initState() {
    super.initState();
    // A legacy account may already carry an unverified number; prefilling it
    // turns this into a single tap.
    final existing = ref.read(authControllerProvider).user?.phoneNumber;
    if (existing != null && existing.isNotEmpty) _phone.text = existing;
  }

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final normalized = toE164(_phone.text);
    if (normalized == null) {
      setState(() => _error = 'Enter a valid phone number, including the country code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _e164 = normalized;
    });

    try {
      final id = await ref.read(authRepositoryProvider).startPhoneVerification(
            normalized,
            // Android auto-retrieves the SMS; finish immediately rather than
            // leaving the user staring at a field that already succeeded.
            onAutoVerified: (credential) => _finish(credential: credential),
            onFailed: (error) {
              if (!mounted) return;
              setState(() {
                _busy = false;
                _error = _firebaseMessage(error);
              });
            },
          );
      if (!mounted) return;
      setState(() {
        _verificationId = id;
        _codeSent = true;
        _busy = false;
      });
    } on fb.FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _firebaseMessage(e);
      });
    }
  }

  Future<void> _finish({fb.PhoneAuthCredential? credential}) async {
    final e164 = _e164;
    if (e164 == null) return;
    if (credential == null && _code.text.trim().length < 6) {
      setState(() => _error = 'Enter the 6-digit code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final repo = ref.read(authRepositoryProvider);
      final user = credential != null
          ? await repo.verifyPhoneCredential(
              e164: e164,
              credential: credential,
              updatePhoneNumber: widget.attachToSession,
            )
          : await repo.verifyPhoneCode(
              e164: e164,
              verificationId: _verificationId!,
              smsCode: _code.text.trim(),
              updatePhoneNumber: widget.attachToSession,
            );
      if (!mounted) return;
      ref.read(authControllerProvider.notifier).adoptVerifiedUser(user);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        final taken = (e.code ?? '').contains('PHONE_NUMBER_EXIST') ||
            e.message.contains('PHONE_NUMBER_EXIST');
        _error = taken
            ? 'That number is already linked to another At-Tayyibun account. '
                'A phone number can only belong to one account.'
            : e.message;
      });
    } on fb.FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _firebaseMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    _codeSent ? Icons.verified_user_outlined : Icons.smartphone,
                    size: 56,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    widget.attachToSession
                        ? 'Verify your phone to continue'
                        : 'Sign up with your phone',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _codeSent
                        ? 'Enter the 6-digit code sent to ${_e164!}'
                        : 'One account per phone number keeps At-Tayyibun free of '
                            'duplicate profiles. Your number is never shown on your profile.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  if (_error != null) ...[
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (!_codeSent)
                    TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: const InputDecoration(
                        labelText: 'Phone number',
                        hintText: '+1 555 123 4567',
                      ),
                    )
                  else
                    TextField(
                      controller: _code,
                      keyboardType: TextInputType.number,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(labelText: '6-digit code'),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : (_codeSent ? () => _finish() : _send),
                    child: _busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_codeSent ? 'Verify & Continue' : 'Send code'),
                  ),
                  if (_codeSent)
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                                _codeSent = false;
                                _code.clear();
                                _error = null;
                              }),
                      child: const Text('Use a different number'),
                    ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => ref.read(authControllerProvider.notifier).signOut(),
                    child: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Turn Firebase's auth/* codes into something a user can act on.
String _firebaseMessage(fb.FirebaseAuthException e) {
  switch (e.code) {
    case 'invalid-phone-number':
      return 'That phone number is not valid. Include the country code.';
    case 'invalid-verification-code':
      return 'That code is not right. Check it and try again.';
    case 'session-expired':
    case 'code-expired':
      return 'That code has expired. Request a new one.';
    case 'too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'quota-exceeded':
      return 'We cannot send codes right now. Please try again later.';
    default:
      return e.message ?? 'Something went wrong. Please try again.';
  }
}
