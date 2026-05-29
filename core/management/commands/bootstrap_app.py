from django.core.management.base import BaseCommand
from core.models import Organization, User

class Command(BaseCommand):
    help = 'Create a clean organization and admin user for production.'

    def add_arguments(self, parser):
        parser.add_argument('--org', type=str, required=True, help='Name of the organization')
        parser.add_argument('--username', type=str, required=True, help='Admin username')
        parser.add_argument('--email', type=str, required=True, help='Admin email')
        parser.add_argument('--password', type=str, required=True, help='Admin password')

    def handle(self, *args, **options):
        # Create organization
        org_name = options['org']
        slug = org_name.lower().replace(' ', '-')
        org, _ = Organization.objects.get_or_create(
            slug=slug,
            defaults={'name': org_name}
        )

        # Create admin user
        username = options['username']
        email = options['email']
        password = options['password']

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'role': User.ROLE_ADMIN,
                'organization': org,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        user.set_password(password)
        user.save()

        status_msg = "Created new" if created else "Updated existing"
        self.stdout.write(self.style.SUCCESS(
            f"Successfully {status_msg.lower()} organization '{org_name}' and admin user '{username}'."
        ))
