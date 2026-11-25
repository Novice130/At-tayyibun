/// Display formatting for a member's city and state.
///
/// The API Title Cases these, but older rows were stored as typed
/// ("lorton, va"), so the app formats them again before showing them.
library;

/// "lorton", "va" -> "Lorton, VA". Empty parts are dropped; a two-letter
/// state is treated as a postal code and uppercased.
String formatPlace(String? city, String? state) {
  final c = _titleCase(city?.trim() ?? '');
  final rawState = state?.trim() ?? '';
  final s = rawState.length == 2
      ? rawState.toUpperCase()
      : _titleCase(rawState);
  return [c, s].where((e) => e.isNotEmpty).join(', ');
}

/// Title Cases words that are all one case ("new york", "NEW YORK"), and
/// leaves mixed-case words ("McLean") as written.
String _titleCase(String input) {
  if (input.isEmpty) return input;
  return input
      .split(RegExp(r'\s+'))
      .map((word) => word.split('-').map(_titleWord).join('-'))
      .join(' ');
}

String _titleWord(String word) {
  if (word.isEmpty) return word;
  final lower = word.toLowerCase();
  final upper = word.toUpperCase();
  if (word != lower && word != upper) return word;
  return upper[0] + lower.substring(1);
}
