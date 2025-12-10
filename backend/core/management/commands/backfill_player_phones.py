from django.core.management.base import BaseCommand
from core.models import Player
import random


class Command(BaseCommand):
    help = 'Preenche celulares faltantes com números aleatórios (somente dígitos), garantindo unicidade'

    def handle(self, *args, **opts):
        players = list(Player.objects.all())
        used = set()
        for p in players:
            digits = ''.join([c for c in (p.phone or '') if c.isdigit()])
            if digits:
                used.add(digits)

        updated = 0
        for p in players:
            digits = ''.join([c for c in (p.phone or '') if c.isdigit()])
            if not digits or len(digits) < 10:
                # generate random 11-digit starting with 9
                attempt = 0
                while True:
                    candidate = '9' + ''.join([str(random.randint(0, 9)) for _ in range(10)])
                    if candidate not in used:
                        digits = candidate
                        used.add(candidate)
                        break
                    attempt += 1
                    if attempt > 100000:
                        raise RuntimeError('Falha ao gerar número único')
                p.phone = digits
                p.userId = digits
                p.save(update_fields=['phone', 'userId'])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'Atualizados {updated} jogadores com celulares aleatórios únicos'))
