from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Group, Player, Field, Match, Transaction, Comment
from .serializers import GroupSerializer, PlayerSerializer, FieldSerializer, MatchSerializer, TransactionSerializer, CommentSerializer
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def by_user(self, request):
        user_id = request.query_params.get('userId')
        if not user_id:
            return Response([], status=status.HTTP_200_OK)
        groups = Group.objects.all()
        filtered = [g for g in groups if (g.adminId == user_id) or (user_id in (g.members or []))]
        serializer = self.get_serializer(filtered, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def request_join(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        pending = group.pendingRequests or []
        members = group.members or []
        if (user_id not in pending) and (user_id not in members):
            pending.append(user_id)
            group.pendingRequests = pending
            group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def generate_invite(self, request, pk=None):
        ttl = int(request.data.get('ttl') or 604800)
        signer = TimestampSigner(salt='group_invite')
        token = signer.sign(pk)
        return Response({'token': token, 'ttl': ttl})

    @action(detail=False, methods=['post'])
    def join_with_invite(self, request):
        token = request.data.get('token')
        user_id = request.data.get('userId')
        signer = TimestampSigner(salt='group_invite')
        try:
            group_id = signer.unsign(token, max_age=604800)
        except SignatureExpired:
            return Response({'detail': 'Convite expirado.'}, status=status.HTTP_400_BAD_REQUEST)
        except BadSignature:
            return Response({'detail': 'Convite inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            group = Group.objects.get(pk=group_id)
        except Group.DoesNotExist:
            return Response({'detail': 'Grupo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        pending = group.pendingRequests or []
        members = group.members or []
        if (user_id not in pending) and (user_id not in members):
            pending.append(user_id)
            group.pendingRequests = pending
            group.save()
        return Response({'status': 'ok', 'groupId': group_id})

    @action(detail=True, methods=['post'])
    def approve_request(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        pending = group.pendingRequests or []
        members = group.members or []
        group.pendingRequests = [u for u in pending if u != user_id]
        if user_id not in members:
            members.append(user_id)
        group.members = members
        group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def reject_request(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        pending = group.pendingRequests or []
        group.pendingRequests = [u for u in pending if u != user_id]
        group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def cancel_request(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        pending = group.pendingRequests or []
        group.pendingRequests = [u for u in pending if u != user_id]
        group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        members = group.members or []
        admins = group.admins or []
        group.members = [u for u in members if u != user_id]
        group.admins = [u for u in admins if u != user_id]
        group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def promote_member(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        admins = group.admins or []
        if user_id not in admins:
            admins.append(user_id)
        group.admins = admins
        group.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def demote_member(self, request, pk=None):
        user_id = request.data.get('userId')
        group = self.get_object()
        if user_id == group.adminId:
            return Response({'status': 'ignored'})
        admins = group.admins or []
        group.admins = [u for u in admins if u != user_id]
        group.save()
        return Response({'status': 'ok'})


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        group_id = self.request.query_params.get('groupId')
        if group_id:
            return Player.objects.filter(groupId=group_id)
        return super().get_queryset()

    @action(detail=False, methods=['post'])
    def update_by_user(self, request):
        user_id = request.data.get('userId')
        data = request.data.get('userData') or {}
        qs = Player.objects.filter(userId=user_id)
        for p in qs:
            p.name = data.get('name', p.name)
            p.nickname = data.get('nickname', p.nickname)
            p.email = data.get('email', p.email)
            p.avatar = data.get('avatar', p.avatar)
            p.phone = data.get('phone', p.phone)
            p.birthDate = data.get('birthDate', p.birthDate)
            p.favoriteTeam = data.get('favoriteTeam', p.favoriteTeam)
            p.position = data.get('position', p.position)
            p.save()
        return Response({'updated': qs.count()})


class FieldViewSet(viewsets.ModelViewSet):
    queryset = Field.objects.all()
    serializer_class = FieldSerializer

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        group_id = self.request.query_params.get('groupId')
        if group_id:
            return Field.objects.filter(groupId=group_id)
        return super().get_queryset()


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        group_id = self.request.query_params.get('groupId')
        if group_id:
            return Match.objects.filter(groupId=group_id)
        return super().get_queryset()

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        instance = self.get_object()
        data = request.data or {}
        for field in [
            'date', 'time', 'fieldId',
            'confirmedPlayerIds', 'paidPlayerIds',
            'teamA', 'teamB',
            'scoreA', 'scoreB',
            'mvpId'
        ]:
            if field in data:
                setattr(instance, field, data[field])
        instance.finished = True
        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        instance = self.get_object()
        instance.finished = False
        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        group_id = self.request.query_params.get('groupId')
        if group_id:
            return Transaction.objects.filter(groupId=group_id)
        return super().get_queryset()

    @action(detail=False, methods=['post'])
    def upsert_match(self, request):
        group_id = request.data.get('groupId')
        match_id = request.data.get('matchId')
        total_amount = float(request.data.get('totalAmount') or 0)
        description = request.data.get('description')
        date = request.data.get('date')

        existing = Transaction.objects.filter(relatedMatchId=match_id).first()
        if total_amount > 0:
            if existing:
                existing.amount = total_amount
                existing.description = description
                existing.date = date
                existing.save()
                tx = existing
            else:
                tx = Transaction.objects.create(
                    id=f"tx_{match_id}",
                    groupId=group_id,
                    relatedMatchId=match_id,
                    description=description,
                    amount=total_amount,
                    type='INCOME',
                    category='MATCH_REVENUE',
                    date=date,
                )
            serializer = self.get_serializer(tx)
            return Response(serializer.data)
        else:
            if existing:
                existing.delete()
            return Response({'status': 'deleted'})


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        try:
            instance = self.get_object()
            return super().update(request, *args, **kwargs)
        except Exception:
            data = request.data.copy()
            data['id'] = pk
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        group_id = self.request.query_params.get('groupId')
        match_id = self.request.query_params.get('matchId')
        qs = super().get_queryset()
        if group_id:
            qs = qs.filter(groupId=group_id)
        if match_id:
            qs = qs.filter(matchId=match_id)
        return qs
