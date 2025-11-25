from django.urls import path
from . import views


urlpatterns = [
    path("", views.home),
    path("register", views.register),
    path("login", views.login),
    path("grupos", views.grupos_list_create),
    path("grupos/<int:id>", views.grupo_detail),
    path("atletas", views.atletas_list_create),
    path("atletas/<int:id>", views.atleta_detail),
    path("campos", views.campos_list_create),
    path("campos/<int:id>", views.campo_detail),
    path("horarios", views.horarios_list_create),
    path("horarios/<int:id>", views.horario_detail),
    path("partidas", views.partidas_list_create),
    path("partidas/<int:id>", views.partida_detail),
]
