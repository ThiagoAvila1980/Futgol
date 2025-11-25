from django.contrib import admin
from .models import Grupo, Campo, Atleta, HorarioSemanal, Partida, AuthToken


admin.site.register(Grupo)
admin.site.register(Campo)
admin.site.register(Atleta)
admin.site.register(HorarioSemanal)
admin.site.register(Partida)
admin.site.register(AuthToken)
