import type { RuntimeAuthProvider } from '../../shared/api-types';

export const copyByAuthProvider: Record<
  RuntimeAuthProvider,
  {
    heading: string;
    subheading: string;
    /** Lead-in for the deploy switcher, describing this deployment's auth model. */
    deployIntro: string;
    signInDescription: string;
    signInButton: string;
    signedOutExamples: string;
  }
> = {
  internal_magic_link: {
    heading: 'Reference Architecture Demo',
    subheading: 'Internal magic-link authentication with user-scoped example records.',
    deployIntro: 'This is the magic-link deployment.',
    signInDescription:
      'Enter your email to receive a magic sign-in link. Example records are scoped to your user.',
    signInButton: 'Send link',
    signedOutExamples:
      'Sign in to view, create, update, and delete your own example records.',
  },
  oidc: {
    heading: 'Reference Architecture Auth0 Demo',
    subheading:
      'Auth0/OIDC authentication with local users and user-scoped example records.',
    deployIntro: 'This is the Auth0/OIDC deployment.',
    signInDescription:
      'Sign in with Auth0 to view and manage your user-scoped example records.',
    signInButton: 'Log in with Auth0',
    signedOutExamples:
      'Sign in to view, create, update, and delete your own example records. Example records are owned by your local app user and isolated from other users.',
  },
  none: {
    heading: 'Reference Architecture Demo',
    subheading: 'Internal magic-link authentication with user-scoped example records.',
    deployIntro: 'This deployment has app authentication disabled.',
    signInDescription:
      'Enter your email to receive a magic sign-in link. Example records are scoped to your user.',
    signInButton: 'Send link',
    signedOutExamples:
      'Sign in to view, create, update, and delete your own example records.',
  },
};

export function getDemoCopy(authProvider: RuntimeAuthProvider) {
  return copyByAuthProvider[authProvider];
}
