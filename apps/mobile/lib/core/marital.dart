/// Marital status options. There is deliberately no "married" value.
const kMaritalOptions = <(String value, String label)>[
  ('NEVER_MARRIED', 'Never married'),
  ('DIVORCED', 'Divorced'),
  ('WIDOWED', 'Widowed'),
];

const kMaritalNotice = 'Attayyibun is for members who are not currently married.';
const kMaritalPrivacy =
    'These answers are private. They are never shown on your profile or in '
    'browse, only to a member you send a request to.';

/// `<Label> · <children>`; null when [status] is null or unknown.
String? formatMaritalLine(String? status, bool? hasChildren, int? childrenCount) {
  if (status == null) return null;
  String? label;
  for (final (value, l) in kMaritalOptions) {
    if (value == status) label = l;
  }
  if (label == null) return null;
  if (hasChildren == null) return label;
  final String children;
  if (!hasChildren) {
    children = 'No children';
  } else if (childrenCount == null) {
    children = 'Has children';
  } else if (childrenCount == 1) {
    children = '1 child';
  } else {
    children = '$childrenCount children';
  }
  return '$label · $children';
}
