import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api_client.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;
  final _tabs = const [
    TabItem('Grupos'),
    TabItem('Atletas'),
    TabItem('Campos'),
    TabItem('Horários'),
    TabItem('Partidas'),
  ];
  @override
  void initState() {
    super.initState();
    ApiClient().init();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_tabs[_index].title),
        actions: [
          IconButton(
            tooltip: 'Grupos',
            icon: const Icon(Icons.group),
            onPressed: () => setState(() => _index = 0),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ApiClient().logout();
              if (!mounted) return;
              Navigator.of(context)
                  .pushNamedAndRemoveUntil('/login', (route) => false);
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          _GruposView(),
          _AtletasView(),
          _CamposView(),
          _HorariosView(),
          _PartidasView(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.group), label: 'Grupos'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Atletas'),
          NavigationDestination(
              icon: Icon(Icons.sports_soccer), label: 'Campos'),
          NavigationDestination(icon: Icon(Icons.schedule), label: 'Horários'),
          NavigationDestination(icon: Icon(Icons.event), label: 'Partidas'),
        ],
        onDestinationSelected: (i) => setState(() => _index = i),
      ),
    );
  }
}

class TabItem {
  final String title;
  const TabItem(this.title);
}

class _GruposView extends StatefulWidget {
  const _GruposView();
  @override
  State<_GruposView> createState() => _GruposViewState();
}

class _GruposViewState extends State<_GruposView> {
  late Future<List<dynamic>> _future;
  final _nome = TextEditingController();
  final _descricao = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = ApiClient().getGrupos();
  }

  Future<void> _criar() async {
    await ApiClient().createGrupo(_nome.text.trim(), _descricao.text.trim());
    setState(() {
      _future = ApiClient().getGrupos();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final itens = snapshot.data!;
          return ListView.builder(
            itemCount: itens.length,
            itemBuilder: (context, i) {
              final g = itens[i];
              return ListTile(
                title: Text(g['nome'] ?? ''),
                subtitle: Text(g['descricao'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () {
                        _nome.text = g['nome'] ?? '';
                        _descricao.text = g['descricao'] ?? '';
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Editar Grupo'),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                TextField(
                                    controller: _nome,
                                    decoration: const InputDecoration(
                                        labelText: 'Nome')),
                                TextField(
                                    controller: _descricao,
                                    decoration: const InputDecoration(
                                        labelText: 'Descrição')),
                              ],
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    await ApiClient().updateGrupo(g['id'],
                                        nome: _nome.text.trim(),
                                        descricao: _descricao.text.trim());
                                    setState(() {
                                      _future = ApiClient().getGrupos();
                                    });
                                  },
                                  child: const Text('Salvar')),
                            ],
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Excluir Grupo'),
                            content: const Text(
                                'Tem certeza que deseja excluir este grupo?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Excluir')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await ApiClient().deleteGrupo(g['id']);
                          setState(() {
                            _future = ApiClient().getGrupos();
                          });
                        }
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _nome.clear();
          _descricao.clear();
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Novo Grupo'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                      controller: _nome,
                      decoration: const InputDecoration(labelText: 'Nome')),
                  TextField(
                      controller: _descricao,
                      decoration:
                          const InputDecoration(labelText: 'Descrição')),
                ],
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar')),
                TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _criar();
                    },
                    child: const Text('Salvar')),
              ],
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _CamposView extends StatefulWidget {
  const _CamposView();
  @override
  State<_CamposView> createState() => _CamposViewState();
}

class _CamposViewState extends State<_CamposView> {
  late Future<List<dynamic>> _future;
  final _nome = TextEditingController();
  final _endereco = TextEditingController();
  final _observacoes = TextEditingController();
  final _preco = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = ApiClient().getCampos();
  }

  Future<void> _criar() async {
    final preco = num.tryParse(_preco.text.trim()) ?? 0;
    await ApiClient().createCampo(_nome.text.trim(), _endereco.text.trim(),
        _observacoes.text.trim(), preco);
    setState(() {
      _future = ApiClient().getCampos();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final itens = snapshot.data!;
          return ListView.builder(
            itemCount: itens.length,
            itemBuilder: (context, i) {
              final c = itens[i];
              return ListTile(
                title: Text(c['nome'] ?? ''),
                subtitle: Text(c['endereco'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () {
                        _nome.text = c['nome'] ?? '';
                        _endereco.text = c['endereco'] ?? '';
                        _observacoes.text = c['observacoes'] ?? '';
                        _preco.text = (c['preco_base'] ?? '0').toString();
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Editar Campo'),
                            content: SingleChildScrollView(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: _nome,
                                      decoration: const InputDecoration(
                                          labelText: 'Nome')),
                                  TextField(
                                      controller: _endereco,
                                      decoration: const InputDecoration(
                                          labelText: 'Endereço')),
                                  TextField(
                                      controller: _observacoes,
                                      decoration: const InputDecoration(
                                          labelText: 'Observações')),
                                  TextField(
                                      controller: _preco,
                                      decoration: const InputDecoration(
                                          labelText: 'Preço base'),
                                      keyboardType: TextInputType.number),
                                ],
                              ),
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    final preco =
                                        num.tryParse(_preco.text.trim());
                                    await ApiClient().updateCampo(c['id'],
                                        nome: _nome.text.trim(),
                                        endereco: _endereco.text.trim(),
                                        observacoes: _observacoes.text.trim(),
                                        precoBase: preco);
                                    setState(() {
                                      _future = ApiClient().getCampos();
                                    });
                                  },
                                  child: const Text('Salvar')),
                            ],
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Excluir Campo'),
                            content: const Text(
                                'Tem certeza que deseja excluir este campo?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Excluir')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await ApiClient().deleteCampo(c['id']);
                          setState(() {
                            _future = ApiClient().getCampos();
                          });
                        }
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _nome.clear();
          _endereco.clear();
          _observacoes.clear();
          _preco.clear();
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Novo Campo'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                        controller: _nome,
                        decoration: const InputDecoration(labelText: 'Nome')),
                    TextField(
                        controller: _endereco,
                        decoration:
                            const InputDecoration(labelText: 'Endereço')),
                    TextField(
                        controller: _observacoes,
                        decoration:
                            const InputDecoration(labelText: 'Observações')),
                    TextField(
                        controller: _preco,
                        decoration:
                            const InputDecoration(labelText: 'Preço base'),
                        keyboardType: TextInputType.number),
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar')),
                TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _criar();
                    },
                    child: const Text('Salvar')),
              ],
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _AtletasView extends StatefulWidget {
  const _AtletasView();
  @override
  State<_AtletasView> createState() => _AtletasViewState();
}

class _AtletasViewState extends State<_AtletasView> {
  late Future<List<dynamic>> _future;
  final _nome = TextEditingController();
  final _apelido = TextEditingController();
  final _telefone = TextEditingController();
  final _email = TextEditingController();

  String _maskPhone(String digits) {
    final d = digits.length > 11 ? digits.substring(0, 11) : digits;
    if (d.isEmpty) return '';
    final b = StringBuffer('(');
    if (d.length <= 2) {
      b.write(d);
    } else {
      b.write(d.substring(0, 2));
    }
    if (d.length >= 2) b.write(')');
    if (d.length > 2) {
      final upTo = d.length >= 7 ? 7 : d.length;
      b.write(d.substring(2, upTo));
    }
    if (d.length > 7) {
      b.write('-');
      b.write(d.substring(7));
    }
    return b.toString();
  }

  bool _validEmail(String email) {
    final re = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return re.hasMatch(email);
  }

  @override
  void initState() {
    super.initState();
    _future = ApiClient().getAtletas();
  }

  Future<void> _criar() async {
    final emailText = _email.text.trim();
    if (emailText.isNotEmpty && !_validEmail(emailText)) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('E-mail inválido')));
      return;
    }
    final telefoneDigits = _telefone.text.replaceAll(RegExp(r'\D'), '');
    await ApiClient().createAtleta(_nome.text.trim(), _apelido.text.trim(),
        telefoneDigits, _email.text.trim(), []);
    setState(() {
      _future = ApiClient().getAtletas();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final itens = snapshot.data!;
          return ListView.builder(
            itemCount: itens.length,
            itemBuilder: (context, i) {
              final a = itens[i];
              return ListTile(
                title: Text(a['nome'] ?? ''),
                subtitle: Text(a['apelido'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () {
                        _nome.text = a['nome'] ?? '';
                        _apelido.text = a['apelido'] ?? '';
                        _telefone.text = a['telefone'] ?? '';
                        _email.text = a['email'] ?? '';
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Editar Atleta'),
                            content: SingleChildScrollView(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: _nome,
                                      decoration: const InputDecoration(
                                          labelText: 'Nome')),
                                  TextField(
                                      controller: _apelido,
                                      decoration: const InputDecoration(
                                          labelText: 'Apelido')),
                                  TextField(
                                      controller: _telefone,
                                      decoration: const InputDecoration(
                                          labelText: 'Telefone',
                                          hintText: '(xx)xxxxx-xxxx'),
                                      keyboardType: TextInputType.phone,
                                      inputFormatters: [
                                        FilteringTextInputFormatter.digitsOnly,
                                        PhoneInputFormatter(),
                                      ],
                                      onChanged: (v) {
                                        final d = v.replaceAll(RegExp(r'\D'), '');
                                        final m = _maskPhone(d);
                                        _telefone.value = TextEditingValue(
                                          text: m,
                                          selection: TextSelection.collapsed(offset: m.length),
                                        );
                                      }),
                                  TextField(
                                      controller: _email,
                                      decoration: const InputDecoration(
                                          labelText: 'E-mail')),
                                ],
                              ),
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    final emailText = _email.text.trim();
                                    if (emailText.isNotEmpty && !_validEmail(emailText)) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(content: Text('E-mail inválido')));
                                      return;
                                    }
                                    final telefoneDigits =
                                        _telefone.text.replaceAll(RegExp(r'\\D'), '');
                                    await ApiClient().updateAtleta(a['id'],
                                        nome: _nome.text.trim(),
                                        apelido: _apelido.text.trim(),
                                        telefone: telefoneDigits,
                                        email: _email.text.trim());
                                    setState(() {
                                      _future = ApiClient().getAtletas();
                                    });
                                  },
                                  child: const Text('Salvar')),
                            ],
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Excluir Atleta'),
                            content: const Text(
                                'Tem certeza que deseja excluir este atleta?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Excluir')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await ApiClient().deleteAtleta(a['id']);
                          setState(() {
                            _future = ApiClient().getAtletas();
                          });
                        }
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _nome.clear();
          _apelido.clear();
          _telefone.clear();
          _email.clear();
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Novo Atleta'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                        controller: _nome,
                        decoration: const InputDecoration(labelText: 'Nome')),
                    TextField(
                        controller: _apelido,
                        decoration:
                            const InputDecoration(labelText: 'Apelido')),
                    TextField(
                        controller: _telefone,
                        decoration: const InputDecoration(
                            labelText: 'Telefone'),
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          PhoneInputFormatter(),
                        ],
                        onChanged: (v) {
                          final d = v.replaceAll(RegExp(r'\D'), '');
                          final m = _maskPhone(d);
                          _telefone.value = TextEditingValue(
                            text: m,
                            selection: TextSelection.collapsed(offset: m.length),
                          );
                        }),
                    TextField(
                        controller: _email,
                        decoration: const InputDecoration(labelText: 'E-mail')),
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar')),
                TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _criar();
                    },
                    child: const Text('Salvar')),
              ],
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class PhoneInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final maxLen = digits.length > 11 ? 11 : digits.length;
    final d = digits.substring(0, maxLen);
    if (d.isEmpty) {
      return const TextEditingValue(text: '');
    }
    final b = StringBuffer();
    b.write('(');
    if (d.length <= 2) {
      b.write(d);
    } else {
      b.write(d.substring(0, 2));
    }
    if (d.length >= 2) {
      b.write(')');
    }
    if (d.length > 2) {
      final upTo = d.length >= 7 ? 7 : d.length;
      b.write(d.substring(2, upTo));
    }
    if (d.length > 7) {
      b.write('-');
      b.write(d.substring(7));
    }
    final f = b.toString();
    return TextEditingValue(
      text: f,
      selection: TextSelection.collapsed(offset: f.length),
    );
  }
}

class _HorariosView extends StatefulWidget {
  const _HorariosView();
  @override
  State<_HorariosView> createState() => _HorariosViewState();
}

class _HorariosViewState extends State<_HorariosView> {
  late Future<List<dynamic>> _future;
  final _grupo = TextEditingController();
  final _dia = TextEditingController();
  final _inicio = TextEditingController();
  final _fim = TextEditingController();
  final _campo = TextEditingController();
  final _valor = TextEditingController();
  final _obs = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = ApiClient().getHorarios();
  }

  Future<void> _criar() async {
    final grupo = int.tryParse(_grupo.text.trim()) ?? 0;
    final dia = int.tryParse(_dia.text.trim()) ?? 0;
    final campo =
        _campo.text.trim().isEmpty ? null : int.tryParse(_campo.text.trim());
    final valor =
        _valor.text.trim().isEmpty ? null : num.tryParse(_valor.text.trim());
    await ApiClient().createHorario(grupo, dia, _inicio.text.trim(),
        _fim.text.trim(), campo, valor, _obs.text.trim());
    setState(() {
      _future = ApiClient().getHorarios();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final itens = snapshot.data!;
          return ListView.builder(
            itemCount: itens.length,
            itemBuilder: (context, i) {
              final h = itens[i];
              return ListTile(
                title: Text(
                    '${h['dia_semana']} ${h['hora_inicio']} - ${h['hora_fim']}'),
                subtitle: Text('${h['observacoes'] ?? ''}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () {
                        _grupo.text = (h['grupo'] ?? '').toString();
                        _dia.text = (h['dia_semana'] ?? '').toString();
                        _inicio.text = h['hora_inicio'] ?? '';
                        _fim.text = h['hora_fim'] ?? '';
                        _campo.text = (h['campo'] ?? '').toString();
                        _valor.text = (h['valor_campo'] ?? '').toString();
                        _obs.text = h['observacoes'] ?? '';
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Editar Horário'),
                            content: SingleChildScrollView(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: _grupo,
                                      decoration: const InputDecoration(
                                          labelText: 'Grupo ID'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _dia,
                                      decoration: const InputDecoration(
                                          labelText: 'Dia da semana (0-6)'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _inicio,
                                      decoration: const InputDecoration(
                                          labelText: 'Hora início (HH:MM:SS)')),
                                  TextField(
                                      controller: _fim,
                                      decoration: const InputDecoration(
                                          labelText: 'Hora fim (HH:MM:SS)')),
                                  TextField(
                                      controller: _campo,
                                      decoration: const InputDecoration(
                                          labelText: 'Campo ID'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _valor,
                                      decoration: const InputDecoration(
                                          labelText: 'Valor do campo'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _obs,
                                      decoration: const InputDecoration(
                                          labelText: 'Observações')),
                                ],
                              ),
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    final grupo =
                                        int.tryParse(_grupo.text.trim());
                                    final dia = int.tryParse(_dia.text.trim());
                                    final campo = _campo.text.trim().isEmpty
                                        ? null
                                        : int.tryParse(_campo.text.trim());
                                    final valor = _valor.text.trim().isEmpty
                                        ? null
                                        : num.tryParse(_valor.text.trim());
                                    await ApiClient().updateHorario(h['id'],
                                        grupo: grupo,
                                        diaSemana: dia,
                                        horaInicio: _inicio.text.trim(),
                                        horaFim: _fim.text.trim(),
                                        campo: campo,
                                        valorCampo: valor,
                                        observacoes: _obs.text.trim());
                                    setState(() {
                                      _future = ApiClient().getHorarios();
                                    });
                                  },
                                  child: const Text('Salvar')),
                            ],
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Excluir Horário'),
                            content: const Text(
                                'Tem certeza que deseja excluir este horário?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Excluir')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await ApiClient().deleteHorario(h['id']);
                          setState(() {
                            _future = ApiClient().getHorarios();
                          });
                        }
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _grupo.clear();
          _dia.clear();
          _inicio.clear();
          _fim.clear();
          _campo.clear();
          _valor.clear();
          _obs.clear();
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Novo Horário'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                        controller: _grupo,
                        decoration:
                            const InputDecoration(labelText: 'Grupo ID'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _dia,
                        decoration: const InputDecoration(
                            labelText: 'Dia da semana (0-6)'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _inicio,
                        decoration: const InputDecoration(
                            labelText: 'Hora início (HH:MM:SS)')),
                    TextField(
                        controller: _fim,
                        decoration: const InputDecoration(
                            labelText: 'Hora fim (HH:MM:SS)')),
                    TextField(
                        controller: _campo,
                        decoration:
                            const InputDecoration(labelText: 'Campo ID'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _valor,
                        decoration:
                            const InputDecoration(labelText: 'Valor do campo'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _obs,
                        decoration:
                            const InputDecoration(labelText: 'Observações')),
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar')),
                TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _criar();
                    },
                    child: const Text('Salvar')),
              ],
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _PartidasView extends StatefulWidget {
  const _PartidasView();
  @override
  State<_PartidasView> createState() => _PartidasViewState();
}

class _PartidasViewState extends State<_PartidasView> {
  late Future<List<dynamic>> _future;
  final _grupo = TextEditingController();
  final _campo = TextEditingController();
  final _data = TextEditingController();
  final _inicio = TextEditingController();
  final _fim = TextEditingController();
  final _valor = TextEditingController();
  final _obs = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = ApiClient().getPartidas();
  }

  Future<void> _criar() async {
    final grupo = int.tryParse(_grupo.text.trim()) ?? 0;
    final campo =
        _campo.text.trim().isEmpty ? null : int.tryParse(_campo.text.trim());
    final valor = num.tryParse(_valor.text.trim()) ?? 0;
    await ApiClient().createPartida(grupo, campo, _data.text.trim(),
        _inicio.text.trim(), _fim.text.trim(), valor, _obs.text.trim(), []);
    setState(() {
      _future = ApiClient().getPartidas();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final itens = snapshot.data!;
          return ListView.builder(
            itemCount: itens.length,
            itemBuilder: (context, i) {
              final p = itens[i];
              return ListTile(
                title: Text('${p['data']} ${p['hora_inicio']}'),
                subtitle: Text(p['observacoes'] ?? ''),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () {
                        _grupo.text = (p['grupo'] ?? '').toString();
                        _campo.text = (p['campo'] ?? '').toString();
                        _data.text = p['data'] ?? '';
                        _inicio.text = p['hora_inicio'] ?? '';
                        _fim.text = p['hora_fim'] ?? '';
                        _valor.text = (p['valor_campo'] ?? '').toString();
                        _obs.text = p['observacoes'] ?? '';
                        showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Editar Partida'),
                            content: SingleChildScrollView(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: _grupo,
                                      decoration: const InputDecoration(
                                          labelText: 'Grupo ID'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _campo,
                                      decoration: const InputDecoration(
                                          labelText: 'Campo ID'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _data,
                                      decoration: const InputDecoration(
                                          labelText: 'Data (YYYY-MM-DD)')),
                                  TextField(
                                      controller: _inicio,
                                      decoration: const InputDecoration(
                                          labelText: 'Hora início (HH:MM:SS)')),
                                  TextField(
                                      controller: _fim,
                                      decoration: const InputDecoration(
                                          labelText: 'Hora fim (HH:MM:SS)')),
                                  TextField(
                                      controller: _valor,
                                      decoration: const InputDecoration(
                                          labelText: 'Valor do campo'),
                                      keyboardType: TextInputType.number),
                                  TextField(
                                      controller: _obs,
                                      decoration: const InputDecoration(
                                          labelText: 'Observações')),
                                ],
                              ),
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    final grupo =
                                        int.tryParse(_grupo.text.trim());
                                    final campo = _campo.text.trim().isEmpty
                                        ? null
                                        : int.tryParse(_campo.text.trim());
                                    final valor =
                                        num.tryParse(_valor.text.trim());
                                    await ApiClient().updatePartida(p['id'],
                                        grupo: grupo,
                                        campo: campo,
                                        data: _data.text.trim(),
                                        horaInicio: _inicio.text.trim(),
                                        horaFim: _fim.text.trim(),
                                        valorCampo: valor,
                                        observacoes: _obs.text.trim());
                                    setState(() {
                                      _future = ApiClient().getPartidas();
                                    });
                                  },
                                  child: const Text('Salvar')),
                            ],
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Excluir Partida'),
                            content: const Text(
                                'Tem certeza que deseja excluir esta partida?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(context, false),
                                  child: const Text('Cancelar')),
                              TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Excluir')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          await ApiClient().deletePartida(p['id']);
                          setState(() {
                            _future = ApiClient().getPartidas();
                          });
                        }
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          _grupo.clear();
          _campo.clear();
          _data.clear();
          _inicio.clear();
          _fim.clear();
          _valor.clear();
          _obs.clear();
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Nova Partida'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                        controller: _grupo,
                        decoration:
                            const InputDecoration(labelText: 'Grupo ID'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _campo,
                        decoration:
                            const InputDecoration(labelText: 'Campo ID'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _data,
                        decoration: const InputDecoration(
                            labelText: 'Data (YYYY-MM-DD)')),
                    TextField(
                        controller: _inicio,
                        decoration: const InputDecoration(
                            labelText: 'Hora início (HH:MM:SS)')),
                    TextField(
                        controller: _fim,
                        decoration: const InputDecoration(
                            labelText: 'Hora fim (HH:MM:SS)')),
                    TextField(
                        controller: _valor,
                        decoration:
                            const InputDecoration(labelText: 'Valor do campo'),
                        keyboardType: TextInputType.number),
                    TextField(
                        controller: _obs,
                        decoration:
                            const InputDecoration(labelText: 'Observações')),
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancelar')),
                TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _criar();
                    },
                    child: const Text('Salvar')),
              ],
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
