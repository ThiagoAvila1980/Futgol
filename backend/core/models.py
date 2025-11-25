from django.contrib.auth.models import User
from django.db import models
from django.utils.crypto import get_random_string


class Grupo(models.Model):
    nome = models.CharField(max_length=120)
    descricao = models.TextField(blank=True)
    dono = models.ForeignKey(User, on_delete=models.CASCADE, related_name="grupos")
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome


class Campo(models.Model):
    nome = models.CharField(max_length=120)
    endereco = models.CharField(max_length=255, blank=True)
    observacoes = models.TextField(blank=True)
    preco_base = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return self.nome


class Atleta(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    nome = models.CharField(max_length=120)
    apelido = models.CharField(max_length=120, blank=True)
    telefone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    grupos = models.ManyToManyField(Grupo, related_name="atletas", blank=True)

    def __str__(self):
        return self.nome


class HorarioSemanal(models.Model):
    grupo = models.ForeignKey(Grupo, on_delete=models.CASCADE, related_name="horarios")
    dia_semana = models.IntegerField()
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    campo = models.ForeignKey(Campo, on_delete=models.SET_NULL, null=True)
    valor_campo = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    observacoes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.grupo.nome} {self.dia_semana} {self.hora_inicio}-{self.hora_fim}"


class Partida(models.Model):
    grupo = models.ForeignKey(Grupo, on_delete=models.CASCADE, related_name="partidas")
    campo = models.ForeignKey(Campo, on_delete=models.SET_NULL, null=True)
    data = models.DateField()
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    valor_campo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    observacoes = models.TextField(blank=True)
    presentes = models.ManyToManyField(Atleta, related_name="presencas", blank=True)

    def __str__(self):
        return f"{self.grupo.nome} {self.data}"


class AuthToken(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    chave = models.CharField(max_length=40, unique=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def criar(usuario):
        chave = get_random_string(40)
        return AuthToken.objects.create(usuario=usuario, chave=chave)
