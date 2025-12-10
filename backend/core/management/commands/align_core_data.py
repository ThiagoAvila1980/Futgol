from django.core.management.base import BaseCommand
from core.models import Group


class Command(BaseCommand):
    help = 'Alinha dados dos modelos core com invariantes atuais'

    def handle(self, *args, **options):
        for g in Group.objects.all():
            admins = list(g.admins or [])
            if g.adminId and g.adminId not in admins:
                admins.append(g.adminId)
            g.admins = list(dict.fromkeys(admins))
            members = list(g.members or [])
            pending = [u for u in (g.pendingRequests or []) if u not in members]
            g.members = list(dict.fromkeys(members))
            g.pendingRequests = list(dict.fromkeys(pending))
            g.save()
