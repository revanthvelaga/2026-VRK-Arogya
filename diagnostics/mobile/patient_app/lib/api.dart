import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Backend base URL. Override at build time:
///   flutter build apk --dart-define=API_BASE=https://your-domain.com/api
const String apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8080/api');

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class Api {
  static String? _token;

  static Future<void> loadToken() async {
    _token = (await SharedPreferences.getInstance()).getString('token');
  }

  static bool get loggedIn => _token != null;

  static Future<void> _saveToken(String? t) async {
    _token = t;
    final p = await SharedPreferences.getInstance();
    if (t == null) {
      await p.remove('token');
    } else {
      await p.setString('token', t);
    }
  }

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = jsonDecode(r.body);
    } catch (_) {
      throw ApiException('Unexpected server response');
    }
    if (r.statusCode >= 400) {
      if (r.statusCode == 401 && _token != null) _saveToken(null);
      throw ApiException(body is Map && body['error'] != null ? body['error'].toString() : 'Request failed');
    }
    return body;
  }

  static Future<dynamic> get(String path) async {
    try {
      return _decode(await http.get(Uri.parse('$apiBase/$path'), headers: _headers).timeout(const Duration(seconds: 20)));
    } on SocketException {
      throw ApiException('No internet connection');
    }
  }

  static Future<dynamic> post(String path, [Map<String, dynamic>? body]) async {
    try {
      return _decode(await http
          .post(Uri.parse('$apiBase/$path'), headers: _headers, body: jsonEncode(body ?? {}))
          .timeout(const Duration(seconds: 20)));
    } on SocketException {
      throw ApiException('No internet connection');
    }
  }

  static Future<void> login(String identifier, String password) async {
    final r = await post('auth/login', {'identifier': identifier, 'password': password});
    if (r['user']['role'] != 'PATIENT') throw ApiException('This app is for patients only');
    await _saveToken(r['token']);
  }

  static Future<void> register(String name, String phone, String email, String password) async {
    final r = await post('auth/register', {'full_name': name, 'phone': phone, 'email': email, 'password': password});
    await _saveToken(r['token']);
  }

  static Future<void> logout() async {
    try {
      await post('auth/logout');
    } catch (_) {}
    await _saveToken(null);
  }

  /// Downloads a report PDF (needs the auth header) and returns the local file path.
  static Future<String> downloadReport(int id, String name) async {
    final r = await http.get(Uri.parse('$apiBase/reports/$id/download'), headers: _headers);
    if (r.statusCode != 200) throw ApiException('Could not download report');
    final dir = await getTemporaryDirectory();
    final safe = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final f = File('${dir.path}/$safe');
    await f.writeAsBytes(r.bodyBytes);
    return f.path;
  }
}
