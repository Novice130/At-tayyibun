import 'dart:async';

import 'package:sentry_flutter/sentry_flutter.dart';

/// Injected at build time, like the web and API DSNs:
///   flutter build ipa --dart-define=SENTRY_DSN=https://...
/// Empty means Sentry is never started and nothing is sent.
const String kSentryDsn = String.fromEnvironment('SENTRY_DSN');
const String _kSentryEnvironment = String.fromEnvironment('SENTRY_ENVIRONMENT');

/// Runs [app], under Sentry when a DSN was built in.
Future<void> runWithCrashReporting(
  FutureOr<void> Function() app, {
  String dsn = kSentryDsn,
}) async {
  if (dsn.isEmpty) {
    await app();
    return;
  }
  await SentryFlutter.init(
    (options) => configureCrashReporting(options, dsn),
    appRunner: app,
  );
}

/// Matrimonial app: never attach identity, request data or message text. This
/// follows apps/api/src/instrument.ts (no user info, no bodies) and the API's
/// exception filter (error class and stack frames, no message). As on the web,
/// there is no session replay. Crashes only: no performance tracing.
void configureCrashReporting(SentryFlutterOptions options, String dsn) {
  options
    ..dsn = dsn
    ..sendDefaultPii = false
    ..attachScreenshot = false
    // ignore: experimental_member_use
    ..attachViewHierarchy = false
    ..maxRequestBodySize = MaxRequestBodySize.never
    ..enablePrintBreadcrumbs = false
    ..enableUserInteractionBreadcrumbs = false
    ..enableUserInteractionTracing = false
    ..enableAutoNativeBreadcrumbs = false
    ..enableAutoPerformanceTracing = false
    ..enableAutoSessionTracking = false
    ..beforeSend = ((event, hint) => scrubEvent(event))
    ..beforeBreadcrumb = ((crumb, hint) => scrubBreadcrumb(crumb));
  if (_kSentryEnvironment.isNotEmpty) {
    options.environment = _kSentryEnvironment;
  }
}

/// Keeps what is needed to find the fault and removes anything that could hold
/// a cookie, an auth header, a URL with a member's id, or personal text.
SentryEvent scrubEvent(SentryEvent event) {
  event
    ..user = null
    ..request = null
    ..message = null
    ..serverName = null
    ..transaction = null
    ..culprit = null
    // ignore: deprecated_member_use
    ..extra = null
    ..breadcrumbs = event.breadcrumbs
        ?.map(scrubBreadcrumb)
        .whereType<Breadcrumb>()
        .toList();
  for (final exception in event.exceptions ?? const <SentryException>[]) {
    exception.value = null;
  }
  event.contexts.remove('flutter_error_details');
  return event;
}

Breadcrumb? scrubBreadcrumb(Breadcrumb? crumb) {
  if (crumb == null) return null;
  return Breadcrumb(
    category: crumb.category,
    level: crumb.level,
    type: crumb.type,
    timestamp: crumb.timestamp,
  );
}
