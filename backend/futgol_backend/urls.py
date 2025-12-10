from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import GroupViewSet, PlayerViewSet, FieldViewSet, MatchViewSet, TransactionViewSet, CommentViewSet
from accounts.views import RegisterView, LoginView, MeView, PasswordResetRequestView, PasswordResetConfirmView, HealthCheckView, LookupByPhoneView

router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'players', PlayerViewSet, basename='player')
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'matches', MatchViewSet, basename='match')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/me/', MeView.as_view()),
    path('api/auth/password/reset/', PasswordResetRequestView.as_view()),
    path('api/auth/password/reset/confirm/', PasswordResetConfirmView.as_view()),
    path('api/health/', HealthCheckView.as_view()),
    path('api/accounts/lookup_by_phone/', LookupByPhoneView.as_view()),
]
