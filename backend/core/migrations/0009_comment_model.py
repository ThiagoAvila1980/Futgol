from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_merge_0007_group_monthlyfee_0007_merge_0006'),
    ]

    operations = [
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('groupId', models.CharField(max_length=64)),
                ('matchId', models.CharField(max_length=64)),
                ('parentId', models.CharField(max_length=64, null=True, blank=True)),
                ('authorPlayerId', models.CharField(max_length=64)),
                ('content', models.TextField()),
                ('createdAt', models.CharField(max_length=25)),
            ],
        ),
    ]

