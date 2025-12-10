from django.contrib import admin
from .models import Group, Player, Field, Match, Transaction

admin.site.register(Group)
admin.site.register(Player)
admin.site.register(Field)
admin.site.register(Match)
admin.site.register(Transaction)
