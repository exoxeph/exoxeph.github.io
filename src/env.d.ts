/// <reference path="../.astro/types.d.ts" />
declare namespace App {
  interface Locals {
    /** Set by the project page so MDX components (Ledger, Claim) can read the current project. */
    project?: import('astro:content').CollectionEntry<'projects'>;
  }
}
