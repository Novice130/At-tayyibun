import 'package:at_tayyibun/core/crash_reporting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('runWithCrashReporting', () {
    test('an empty DSN runs the app without starting Sentry', () async {
      var ran = false;
      await runWithCrashReporting(() async => ran = true, dsn: '');
      expect(ran, isTrue);
      expect(Sentry.isEnabled, isFalse);
    });
  });

  group('configureCrashReporting', () {
    test('turns off everything that could carry personal data', () {
      final options = SentryFlutterOptions();
      configureCrashReporting(options, 'https://k@o.example/1');

      expect(options.dsn, 'https://k@o.example/1');
      expect(options.sendDefaultPii, isFalse);
      expect(options.attachScreenshot, isFalse);
      // ignore: experimental_member_use
      expect(options.attachViewHierarchy, isFalse);
      expect(options.maxRequestBodySize, MaxRequestBodySize.never);
      expect(options.enablePrintBreadcrumbs, isFalse);
      expect(options.enableUserInteractionBreadcrumbs, isFalse);
      expect(options.enableAutoNativeBreadcrumbs, isFalse);
      expect(options.enableAutoSessionTracking, isFalse);
      expect(options.tracesSampleRate, isNull);
      expect(options.replay.sessionSampleRate, anyOf(isNull, 0));
      expect(options.replay.onErrorSampleRate, anyOf(isNull, 0));
      expect(options.beforeSend, isNotNull);
      expect(options.beforeBreadcrumb, isNotNull);
    });
  });

  group('scrubEvent', () {
    SentryEvent dirty() => SentryEvent(
          user: SentryUser(id: 'usr_1', email: 'a@b.com'),
          serverName: 'phone-name',
          transaction: '/profiles/AB12',
          culprit: '/profiles/AB12',
          message: SentryMessage('a@b.com failed'),
          request: SentryRequest(
            url: 'https://attayyibun.com/x?token=secret',
            queryString: 'token=secret',
            cookies: '__Secure-better-auth.session_token=secret',
            headers: {'Authorization': 'Bearer secret', 'Cookie': 'secret'},
            data: {'password': 'secret'},
          ),
          // ignore: deprecated_member_use
          extra: {'body': 'secret'},
          exceptions: [
            SentryException(
              type: 'DioException',
              value: 'GET https://attayyibun.com/x?token=secret for a@b.com',
              stackTrace: SentryStackTrace(frames: [
                SentryStackFrame(function: 'main'),
              ]),
            ),
          ],
          breadcrumbs: [
            Breadcrumb(
              message: 'Cookie: secret',
              category: 'http',
              data: {'url': 'https://attayyibun.com/x?token=secret'},
            ),
          ],
        );

    test('removes identity, requests and message text', () {
      final event = scrubEvent(dirty());
      final json = event.toJson().toString();

      expect(json, isNot(contains('secret')));
      expect(json, isNot(contains('a@b.com')));
      expect(json, isNot(contains('AB12')));
      expect(json, isNot(contains('phone-name')));
      expect(event.user, isNull);
      expect(event.request, isNull);
    });

    test('keeps the error class and stack frames, like the API filter', () {
      final exception = scrubEvent(dirty()).exceptions!.single;

      expect(exception.type, 'DioException');
      expect(exception.value, isNull);
      expect(exception.stackTrace!.frames.single.function, 'main');
    });

    test('drops Flutter error details, which quote widget text', () {
      final event = dirty();
      event.contexts['flutter_error_details'] = {'information': 'a@b.com'};

      expect(scrubEvent(event).contexts['flutter_error_details'], isNull);
    });
  });

  group('scrubBreadcrumb', () {
    test('keeps only the category and level', () {
      final crumb = scrubBreadcrumb(Breadcrumb(
        message: 'a@b.com',
        category: 'navigation',
        level: SentryLevel.warning,
        data: {'to': '/profiles/AB12'},
      ));

      expect(crumb!.message, isNull);
      expect(crumb.data, isNull);
      expect(crumb.category, 'navigation');
      expect(crumb.level, SentryLevel.warning);
    });

    test('passes a null through', () {
      expect(scrubBreadcrumb(null), isNull);
    });
  });
}
