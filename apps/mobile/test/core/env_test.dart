import 'package:at_tayyibun/core/env.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppEnv.fromFlavor', () {
    test('dev flavor talks to staging', () {
      final env = AppEnv.fromFlavor('dev');
      expect(env, AppEnv.dev);
      expect(env.baseUrl, 'https://staging.attayyibun.com');
      expect(env.appName, 'At-Tayyibun Dev');
    });

    test('prod flavor talks to production', () {
      final env = AppEnv.fromFlavor('prod');
      expect(env, AppEnv.prod);
      expect(env.baseUrl, 'https://attayyibun.com');
      expect(env.appName, 'At-Tayyibun');
    });

    test('no flavor (flutter test, plain flutter run) is prod', () {
      expect(AppEnv.fromFlavor(null), AppEnv.prod);
    });

    test('an unknown flavor fails instead of silently picking a server', () {
      expect(() => AppEnv.fromFlavor('staging'), throwsStateError);
      expect(() => AppEnv.fromFlavor(''), throwsStateError);
    });

    test('no environment points at the other one', () {
      expect(AppEnv.dev.baseUrl, isNot(contains('//attayyibun.com')));
      expect(AppEnv.prod.baseUrl, isNot(contains('staging')));
    });
  });
}
