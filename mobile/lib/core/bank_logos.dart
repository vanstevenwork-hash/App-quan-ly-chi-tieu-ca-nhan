/// Bank logos from the VietQR CDN (`/img/<CODE>.png`, verified Nov 2026).
/// Every spelling we store in bankShortName (VietQR shortName, VietQR code,
/// older codes) maps to the VietQR code.
const _cdn = 'https://cdn.vietqr.io/img';

const Map<String, String> _codeByAlias = {
  'VCB': 'VCB', 'VIETCOMBANK': 'VCB',
  'BIDV': 'BIDV',
  'ICB': 'ICB', 'CTG': 'ICB', 'VTB': 'ICB', 'VIETINBANK': 'ICB',
  'ACB': 'ACB',
  'TCB': 'TCB', 'TECHCOMBANK': 'TCB',
  'MB': 'MB', 'MBB': 'MB', 'MBBANK': 'MB',
  'VPB': 'VPB', 'VPBANK': 'VPB',
  'VIB': 'VIB',
  'STB': 'STB', 'SACOMBANK': 'STB',
  'MSB': 'MSB',
  'SHB': 'SHB',
  'HDB': 'HDB', 'HDBANK': 'HDB',
  'TPB': 'TPB', 'TPBANK': 'TPB',
  'OCB': 'OCB',
  'NAB': 'NAB', 'NAMABANK': 'NAB',
  'EIB': 'EIB', 'EXIMBANK': 'EIB',
  'SCB': 'SCB',
  'SEAB': 'SEAB', 'SEABANK': 'SEAB',
  'BAB': 'BAB', 'BACABANK': 'BAB',
  'LPB': 'LPB', 'LPBANK': 'LPB',
  'CAKE': 'CAKE',
  'UOB': 'UOB', 'UNITEDOVERSEAS': 'UOB',
  'HSBC': 'HSBC',
  'SHBVN': 'SHBVN', 'SHINHANBANK': 'SHBVN', 'SHINHAN': 'SHBVN',
  'VCCB': 'VCCB', 'BVBANK': 'VCCB', 'BVB': 'VCCB', 'VIETCAPITALBANK': 'VCCB',
  'ABB': 'ABB', 'ABBANK': 'ABB',
  'NCB': 'NCB',
  'VBA': 'VBA', 'AGRIBANK': 'VBA',
  'KBANK': 'KBank',
  'WVN': 'WVN', 'WOORI': 'WVN',
  'SCVN': 'SCVN', 'STANDARDCHARTERED': 'SCVN',
  'CITI': 'CITIBANK', 'CITIBANK': 'CITIBANK',
  'PVCB': 'PVCB', 'PVCOMBANK': 'PVCB',
  'VAB': 'VAB', 'VIETABANK': 'VAB',
  'TIMO': 'TIMO',
};

String _key(String s) => s.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

String? bankLogo(String? bankShortName, [String? bankName]) {
  final direct = _codeByAlias[_key(bankShortName ?? '')] ?? _codeByAlias[_key(bankName ?? '')];
  if (direct != null) return '$_cdn/$direct.png';
  // "VIB Super card" → VIB
  for (final w in (bankName ?? '').split(RegExp(r'\s+'))) {
    final code = _codeByAlias[_key(w)];
    if (code != null) return '$_cdn/$code.png';
  }
  return null;
}
