from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_group_city'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='monthlyFee',
            field=models.FloatField(default=0),
        ),
    ]

