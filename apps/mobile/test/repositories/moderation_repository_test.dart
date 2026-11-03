import 'package:at_tayyibun/repositories/moderation_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

void main() {
  test('the blocked list parses rows without an email field', () async {
    final repo = ModerationRepository(fakeApiClient((_) async => jsonBody([
          {'targetPublicId': 'AB12', 'name': 'Sara', 'createdAt': '2026-11-01'},
          {'targetPublicId': 'CD34', 'name': null},
        ])));

    final blocked = await repo.blocked();

    expect(blocked.map((b) => b.targetPublicId), ['AB12', 'CD34']);
    expect(blocked.first.name, 'Sara');
    expect(blocked.last.name, isNull);
  });
}
