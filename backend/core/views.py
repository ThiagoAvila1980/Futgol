import json
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Grupo, Campo, Atleta, HorarioSemanal, Partida, AuthToken
from django.shortcuts import render


def _json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        return {}


def _user_from_token(request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Token "):
        chave = auth.split(" ", 1)[1]
        try:
            token = AuthToken.objects.get(chave=chave)
            return token.usuario
        except AuthToken.DoesNotExist:
            return None
    return None


@csrf_exempt
def register(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    data = _json_body(request)
    username = data.get("usuario")
    password = data.get("senha")
    email = data.get("email", "")
    if not username or not password:
        return JsonResponse({"erro": "usuario e senha obrigatorios"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"erro": "usuario existente"}, status=400)
    user = User.objects.create_user(username=username, password=password, email=email)
    token = AuthToken.criar(user)
    return JsonResponse({"token": token.chave})


@csrf_exempt
def login(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    data = _json_body(request)
    user = authenticate(username=data.get("usuario"), password=data.get("senha"))
    if not user:
        return JsonResponse({"erro": "credenciais invalidas"}, status=401)
    token = AuthToken.criar(user)
    return JsonResponse({"token": token.chave})


@csrf_exempt
def grupos_list_create(request):
    if request.method == "GET":
        grupos = [
            {
                "id": g.id,
                "nome": g.nome,
                "descricao": g.descricao,
                "dono": g.dono_id,
            }
            for g in Grupo.objects.all()
        ]
        return JsonResponse({"grupos": grupos})
    if request.method == "POST":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        g = Grupo.objects.create(
            nome=data.get("nome", ""),
            descricao=data.get("descricao", ""),
            dono=user,
        )
        return JsonResponse({"id": g.id})
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def grupo_detail(request, id):
    try:
        g = Grupo.objects.get(id=id)
    except Grupo.DoesNotExist:
        return JsonResponse({"erro": "nao encontrado"}, status=404)
    if request.method == "GET":
        return JsonResponse({"id": g.id, "nome": g.nome, "descricao": g.descricao, "dono": g.dono_id})
    if request.method == "PUT":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        if "nome" in data:
            g.nome = data["nome"]
        if "descricao" in data:
            g.descricao = data["descricao"]
        g.save()
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        g.delete()
        return JsonResponse({"ok": True})
    return HttpResponseNotAllowed(["GET", "PUT", "DELETE"])


@csrf_exempt
def atletas_list_create(request):
    if request.method == "GET":
        atletas = [
            {
                "id": a.id,
                "nome": a.nome,
                "apelido": a.apelido,
                "telefone": a.telefone,
                "email": a.email,
                "grupos": list(a.grupos.values_list("id", flat=True)),
            }
            for a in Atleta.objects.all()
        ]
        return JsonResponse({"atletas": atletas})
    if request.method == "POST":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        a = Atleta.objects.create(
            usuario=user if data.get("use_usuario") else None,
            nome=data.get("nome", ""),
            apelido=data.get("apelido", ""),
            telefone=data.get("telefone", ""),
            email=data.get("email", ""),
        )
        grupos_ids = data.get("grupos", [])
        if grupos_ids:
            a.grupos.set(Grupo.objects.filter(id__in=grupos_ids))
        return JsonResponse({"id": a.id})
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def atleta_detail(request, id):
    try:
        a = Atleta.objects.get(id=id)
    except Atleta.DoesNotExist:
        return JsonResponse({"erro": "nao encontrado"}, status=404)
    if request.method == "GET":
        return JsonResponse({
            "id": a.id,
            "nome": a.nome,
            "apelido": a.apelido,
            "telefone": a.telefone,
            "email": a.email,
            "grupos": list(a.grupos.values_list("id", flat=True)),
        })
    if request.method == "PUT":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        for k in ["nome", "apelido", "telefone", "email"]:
            if k in data:
                setattr(a, k, data[k])
        if "grupos" in data:
            a.grupos.set(Grupo.objects.filter(id__in=data.get("grupos", [])))
        a.save()
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        a.delete()
        return JsonResponse({"ok": True})
    return HttpResponseNotAllowed(["GET", "PUT", "DELETE"])


@csrf_exempt
def campos_list_create(request):
    if request.method == "GET":
        campos = [
            {
                "id": c.id,
                "nome": c.nome,
                "endereco": c.endereco,
                "observacoes": c.observacoes,
                "preco_base": str(c.preco_base),
            }
            for c in Campo.objects.all()
        ]
        return JsonResponse({"campos": campos})
    if request.method == "POST":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        c = Campo.objects.create(
            nome=data.get("nome", ""),
            endereco=data.get("endereco", ""),
            observacoes=data.get("observacoes", ""),
            preco_base=data.get("preco_base", 0),
        )
        return JsonResponse({"id": c.id})
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def campo_detail(request, id):
    try:
        c = Campo.objects.get(id=id)
    except Campo.DoesNotExist:
        return JsonResponse({"erro": "nao encontrado"}, status=404)
    if request.method == "GET":
        return JsonResponse({
            "id": c.id,
            "nome": c.nome,
            "endereco": c.endereco,
            "observacoes": c.observacoes,
            "preco_base": str(c.preco_base),
        })
    if request.method == "PUT":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        for k in ["nome", "endereco", "observacoes", "preco_base"]:
            if k in data:
                setattr(c, k, data[k])
        c.save()
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        c.delete()
        return JsonResponse({"ok": True})
    return HttpResponseNotAllowed(["GET", "PUT", "DELETE"])


@csrf_exempt
def horarios_list_create(request):
    if request.method == "GET":
        horarios = [
            {
                "id": h.id,
                "grupo": h.grupo_id,
                "dia_semana": h.dia_semana,
                "hora_inicio": h.hora_inicio.isoformat(),
                "hora_fim": h.hora_fim.isoformat(),
                "campo": h.campo_id,
                "valor_campo": str(h.valor_campo) if h.valor_campo is not None else None,
                "observacoes": h.observacoes,
            }
            for h in HorarioSemanal.objects.all()
        ]
        return JsonResponse({"horarios": horarios})
    if request.method == "POST":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        g = Grupo.objects.get(id=data.get("grupo"))
        campo = Campo.objects.get(id=data.get("campo")) if data.get("campo") else None
        h = HorarioSemanal.objects.create(
            grupo=g,
            dia_semana=data.get("dia_semana"),
            hora_inicio=data.get("hora_inicio"),
            hora_fim=data.get("hora_fim"),
            campo=campo,
            valor_campo=data.get("valor_campo"),
            observacoes=data.get("observacoes", ""),
        )
        return JsonResponse({"id": h.id})
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def horario_detail(request, id):
    try:
        h = HorarioSemanal.objects.get(id=id)
    except HorarioSemanal.DoesNotExist:
        return JsonResponse({"erro": "nao encontrado"}, status=404)
    if request.method == "GET":
        return JsonResponse({
            "id": h.id,
            "grupo": h.grupo_id,
            "dia_semana": h.dia_semana,
            "hora_inicio": h.hora_inicio.isoformat(),
            "hora_fim": h.hora_fim.isoformat(),
            "campo": h.campo_id,
            "valor_campo": str(h.valor_campo) if h.valor_campo is not None else None,
            "observacoes": h.observacoes,
        })
    if request.method == "PUT":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        if "grupo" in data:
            h.grupo = Grupo.objects.get(id=data["grupo"])
        if "dia_semana" in data:
            h.dia_semana = data["dia_semana"]
        if "hora_inicio" in data:
            h.hora_inicio = data["hora_inicio"]
        if "hora_fim" in data:
            h.hora_fim = data["hora_fim"]
        if "campo" in data:
            h.campo = Campo.objects.get(id=data["campo"]) if data["campo"] else None
        if "valor_campo" in data:
            h.valor_campo = data["valor_campo"]
        if "observacoes" in data:
            h.observacoes = data["observacoes"]
        h.save()
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        h.delete()
        return JsonResponse({"ok": True})
    return HttpResponseNotAllowed(["GET", "PUT", "DELETE"])


@csrf_exempt
def partidas_list_create(request):
    if request.method == "GET":
        partidas = [
            {
                "id": p.id,
                "grupo": p.grupo_id,
                "campo": p.campo_id,
                "data": p.data.isoformat(),
                "hora_inicio": p.hora_inicio.isoformat(),
                "hora_fim": p.hora_fim.isoformat(),
                "valor_campo": str(p.valor_campo),
                "observacoes": p.observacoes,
                "presentes": list(p.presentes.values_list("id", flat=True)),
            }
            for p in Partida.objects.all()
        ]
        return JsonResponse({"partidas": partidas})
    if request.method == "POST":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        g = Grupo.objects.get(id=data.get("grupo"))
        campo = Campo.objects.get(id=data.get("campo")) if data.get("campo") else None
        p = Partida.objects.create(
            grupo=g,
            campo=campo,
            data=data.get("data"),
            hora_inicio=data.get("hora_inicio"),
            hora_fim=data.get("hora_fim"),
            valor_campo=data.get("valor_campo", 0),
            observacoes=data.get("observacoes", ""),
        )
        presentes_ids = data.get("presentes", [])
        if presentes_ids:
            p.presentes.set(Atleta.objects.filter(id__in=presentes_ids))
        return JsonResponse({"id": p.id})
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def partida_detail(request, id):
    try:
        p = Partida.objects.get(id=id)
    except Partida.DoesNotExist:
        return JsonResponse({"erro": "nao encontrado"}, status=404)
    if request.method == "GET":
        return JsonResponse({
            "id": p.id,
            "grupo": p.grupo_id,
            "campo": p.campo_id,
            "data": p.data.isoformat(),
            "hora_inicio": p.hora_inicio.isoformat(),
            "hora_fim": p.hora_fim.isoformat(),
            "valor_campo": str(p.valor_campo),
            "observacoes": p.observacoes,
            "presentes": list(p.presentes.values_list("id", flat=True)),
        })
    if request.method == "PUT":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        data = _json_body(request)
        if "grupo" in data:
            p.grupo = Grupo.objects.get(id=data["grupo"]) 
        if "campo" in data:
            p.campo = Campo.objects.get(id=data["campo"]) if data["campo"] else None
        for k in ["data", "hora_inicio", "hora_fim", "valor_campo", "observacoes"]:
            if k in data:
                setattr(p, k, data[k])
        if "presentes" in data:
            p.presentes.set(Atleta.objects.filter(id__in=data.get("presentes", [])))
        p.save()
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        user = _user_from_token(request)
        if not user:
            return JsonResponse({"erro": "nao autorizado"}, status=401)
        p.delete()
        return JsonResponse({"ok": True})
    return HttpResponseNotAllowed(["GET", "PUT", "DELETE"])
def home(request):
    return render(request, "core/index.html")
