# Generated manually to enforce unique phone and non-null
from django.db import migrations, models


def normalize_and_fill_phones(apps, schema_editor):
    Player = apps.get_model('core', 'Player')
    used = set()
    # Collect existing non-empty normalized phones
    for p in Player.objects.all():
        digits = ''.join([c for c in (p.phone or '') if c.isdigit()])
        if digits:
            used.add(digits)
    # Assign normalized phones; generate synthetic unique for empties
    counter = 0
    for p in Player.objects.all():
        digits = ''.join([c for c in (p.phone or '') if c.isdigit()])
        if not digits:
            # generate unique 11-digit starting with 999
            while True:
                candidate = f"999{str(10000000 + counter).zfill(8)}"[:11]
                counter += 1
                if candidate not in used:
                    digits = candidate
                    used.add(candidate)
                    break
        p.phone = digits
        p.save(update_fields=['phone'])


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0003_player_isguest'),
    ]

    operations = [
        migrations.RunPython(normalize_and_fill_phones, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='player',
            name='phone',
            field=models.CharField(max_length=50, unique=True),
        ),
    ]
