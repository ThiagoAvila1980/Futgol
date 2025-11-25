import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late final String baseUrl = kIsWeb
      ? 'http://${Uri.base.host}:8000/api/'
      : 'http://127.0.0.1:8000/api/';
  String? _token;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
  }

  bool get hasToken => _token != null;

  Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  Future<void> setToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
  }

  Map<String, String> _headers({bool auth = false}) {
    final h = {'Content-Type': 'application/json'};
    if (auth && _token != null) h['Authorization'] = 'Token $_token';
    return h;
  }

  Future<Map<String, dynamic>> register(
      String usuario, String senha, String email) async {
    final res = await http.post(Uri.parse('${baseUrl}register'),
        headers: _headers(),
        body: jsonEncode({'usuario': usuario, 'senha': senha, 'email': email}));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        data['token'] != null) {
      await setToken(data['token']);
      return data;
    }
    throw Exception(data['erro'] ?? 'Falha ao registrar');
  }

  Future<Map<String, dynamic>> login(String usuario, String senha) async {
    final res = await http.post(Uri.parse('${baseUrl}login'),
        headers: _headers(),
        body: jsonEncode({'usuario': usuario, 'senha': senha}));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        data['token'] != null) {
      await setToken(data['token']);
      return data;
    }
    throw Exception(data['erro'] ?? 'Falha ao entrar');
  }

  Future<List<dynamic>> getGrupos() async {
    final res =
        await http.get(Uri.parse('${baseUrl}grupos'), headers: _headers());
    final data = jsonDecode(res.body);
    return data['grupos'] ?? [];
  }

  Future<int> createGrupo(String nome, String descricao) async {
    final res = await http.post(Uri.parse('${baseUrl}grupos'),
        headers: _headers(auth: true),
        body: jsonEncode({'nome': nome, 'descricao': descricao}));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300)
      return (data['id'] as num).toInt();
    throw Exception(data['erro'] ?? 'Falha ao criar grupo');
  }

  Future<void> updateGrupo(int id, {String? nome, String? descricao}) async {
    final body = {
      if (nome != null) 'nome': nome,
      if (descricao != null) 'descricao': descricao
    };
    final res = await http.put(Uri.parse('${baseUrl}grupos/$id'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception(data['erro'] ?? 'Falha ao atualizar grupo');
  }

  Future<void> deleteGrupo(int id) async {
    final res = await http.delete(Uri.parse('${baseUrl}grupos/$id'),
        headers: _headers(auth: true));
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception('Falha ao excluir grupo');
  }

  Future<List<dynamic>> getAtletas() async {
    final res =
        await http.get(Uri.parse('${baseUrl}atletas'), headers: _headers());
    final data = jsonDecode(res.body);
    return data['atletas'] ?? [];
  }

  Future<int> createAtleta(String nome, String apelido, String telefone,
      String email, List<int> grupos) async {
    final body = {
      'nome': nome,
      'apelido': apelido,
      'telefone': telefone,
      'email': email,
      'grupos': grupos
    };
    final res = await http.post(Uri.parse('${baseUrl}atletas'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300)
      return (data['id'] as num).toInt();
    throw Exception(data['erro'] ?? 'Falha ao criar atleta');
  }

  Future<void> updateAtleta(int id,
      {String? nome,
      String? apelido,
      String? telefone,
      String? email,
      List<int>? grupos}) async {
    final body = {
      if (nome != null) 'nome': nome,
      if (apelido != null) 'apelido': apelido,
      if (telefone != null) 'telefone': telefone,
      if (email != null) 'email': email,
      if (grupos != null) 'grupos': grupos,
    };
    final res = await http.put(Uri.parse('${baseUrl}atletas/$id'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception(data['erro'] ?? 'Falha ao atualizar atleta');
  }

  Future<void> deleteAtleta(int id) async {
    final res = await http.delete(Uri.parse('${baseUrl}atletas/$id'),
        headers: _headers(auth: true));
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception('Falha ao excluir atleta');
  }

  Future<List<dynamic>> getCampos() async {
    final res =
        await http.get(Uri.parse('${baseUrl}campos'), headers: _headers());
    final data = jsonDecode(res.body);
    return data['campos'] ?? [];
  }

  Future<int> createCampo(
      String nome, String endereco, String observacoes, num precoBase) async {
    final body = {
      'nome': nome,
      'endereco': endereco,
      'observacoes': observacoes,
      'preco_base': precoBase
    };
    final res = await http.post(Uri.parse('${baseUrl}campos'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300)
      return (data['id'] as num).toInt();
    throw Exception(data['erro'] ?? 'Falha ao criar campo');
  }

  Future<void> updateCampo(int id,
      {String? nome,
      String? endereco,
      String? observacoes,
      num? precoBase}) async {
    final body = {
      if (nome != null) 'nome': nome,
      if (endereco != null) 'endereco': endereco,
      if (observacoes != null) 'observacoes': observacoes,
      if (precoBase != null) 'preco_base': precoBase,
    };
    final res = await http.put(Uri.parse('${baseUrl}campos/$id'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception(data['erro'] ?? 'Falha ao atualizar campo');
  }

  Future<void> deleteCampo(int id) async {
    final res = await http.delete(Uri.parse('${baseUrl}campos/$id'),
        headers: _headers(auth: true));
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception('Falha ao excluir campo');
  }

  Future<List<dynamic>> getHorarios() async {
    final res =
        await http.get(Uri.parse('${baseUrl}horarios'), headers: _headers());
    final data = jsonDecode(res.body);
    return data['horarios'] ?? [];
  }

  Future<int> createHorario(int grupo, int diaSemana, String horaInicio,
      String horaFim, int? campo, num? valorCampo, String observacoes) async {
    final body = {
      'grupo': grupo,
      'dia_semana': diaSemana,
      'hora_inicio': horaInicio,
      'hora_fim': horaFim,
      'campo': campo,
      'valor_campo': valorCampo,
      'observacoes': observacoes
    };
    final res = await http.post(Uri.parse('${baseUrl}horarios'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300)
      return (data['id'] as num).toInt();
    throw Exception(data['erro'] ?? 'Falha ao criar horário');
  }

  Future<void> updateHorario(int id,
      {int? grupo,
      int? diaSemana,
      String? horaInicio,
      String? horaFim,
      int? campo,
      num? valorCampo,
      String? observacoes}) async {
    final body = {
      if (grupo != null) 'grupo': grupo,
      if (diaSemana != null) 'dia_semana': diaSemana,
      if (horaInicio != null) 'hora_inicio': horaInicio,
      if (horaFim != null) 'hora_fim': horaFim,
      'campo': campo,
      'valor_campo': valorCampo,
      if (observacoes != null) 'observacoes': observacoes,
    };
    final res = await http.put(Uri.parse('${baseUrl}horarios/$id'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final data = jsonDecode(res.body);
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception(data['erro'] ?? 'Falha ao atualizar horário');
  }

  Future<void> deleteHorario(int id) async {
    final res = await http.delete(Uri.parse('${baseUrl}horarios/$id'),
        headers: _headers(auth: true));
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception('Falha ao excluir horário');
  }

  Future<List<dynamic>> getPartidas() async {
    final res =
        await http.get(Uri.parse('${baseUrl}partidas'), headers: _headers());
    final data = jsonDecode(res.body);
    return data['partidas'] ?? [];
  }

  Future<int> createPartida(
      int grupo,
      int? campo,
      String data,
      String horaInicio,
      String horaFim,
      num valorCampo,
      String observacoes,
      List<int> presentes) async {
    final body = {
      'grupo': grupo,
      'campo': campo,
      'data': data,
      'hora_inicio': horaInicio,
      'hora_fim': horaFim,
      'valor_campo': valorCampo,
      'observacoes': observacoes,
      'presentes': presentes
    };
    final res = await http.post(Uri.parse('${baseUrl}partidas'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final jsonRes = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300)
      return (jsonRes['id'] as num).toInt();
    throw Exception(jsonRes['erro'] ?? 'Falha ao criar partida');
  }

  Future<void> updatePartida(int id,
      {int? grupo,
      int? campo,
      String? data,
      String? horaInicio,
      String? horaFim,
      num? valorCampo,
      String? observacoes,
      List<int>? presentes}) async {
    final body = {
      if (grupo != null) 'grupo': grupo,
      'campo': campo,
      if (data != null) 'data': data,
      if (horaInicio != null) 'hora_inicio': horaInicio,
      if (horaFim != null) 'hora_fim': horaFim,
      if (valorCampo != null) 'valor_campo': valorCampo,
      if (observacoes != null) 'observacoes': observacoes,
      if (presentes != null) 'presentes': presentes,
    };
    final res = await http.put(Uri.parse('${baseUrl}partidas/$id'),
        headers: _headers(auth: true), body: jsonEncode(body));
    final dataRes = jsonDecode(res.body);
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception(dataRes['erro'] ?? 'Falha ao atualizar partida');
  }

  Future<void> deletePartida(int id) async {
    final res = await http.delete(Uri.parse('${baseUrl}partidas/$id'),
        headers: _headers(auth: true));
    if (!(res.statusCode >= 200 && res.statusCode < 300))
      throw Exception('Falha ao excluir partida');
  }
}
