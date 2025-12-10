import os
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connections


class Command(BaseCommand):
    help = 'Exibe informações de conexão do banco e testa conectividade'

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        self.stdout.write('DATABASE SETTINGS:')
        for k in ['ENGINE', 'NAME', 'USER', 'HOST', 'PORT']:
            self.stdout.write(f"  {k}: {db.get(k)}")

        self.stdout.write('\nENV VARS:')
        for k in ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'POSTGRES_PORT']:
            self.stdout.write(f"  {k}: {os.environ.get(k)}")

        try:
            with connections['default'].cursor() as cursor:
                cursor.execute('SELECT current_database(), current_user')
                row = cursor.fetchone()
                self.stdout.write(f"\nConnected OK -> database={row[0]} user={row[1]}")
        except Exception as e:
            self.stderr.write(f"\nConnection FAILED: {e}")
