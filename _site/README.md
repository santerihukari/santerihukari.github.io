# santerihukari.github.io

Personal website of Santeri Hukari.

## Local development

1. Install Ruby 3.4.9. On Windows, the RubyInstaller package named `3.4.9-1` is fine; the Ruby runtime version used by Bundler is `3.4.9`.
2. Run `bundle install` to resolve the updated Jekyll dependencies and regenerate `Gemfile.lock`.
3. Run `bundle exec jekyll serve --livereload`.
4. Open <http://127.0.0.1:4000>.

## Deployment

The site now deploys through GitHub Actions using [`.github/workflows/pages.yml`](/C:/Users/sante/OneDrive/Desktop/santerihukari.github.io/.github/workflows/pages.yml).

After pushing the workflow:

1. Open the repository's GitHub Pages settings.
2. Set the publishing source to `GitHub Actions`.
3. Keep the repository default branch as the deployment branch; the workflow only publishes from that branch.

## One-time cleanup

This repo currently contains a checked-in `_site/` build output directory from the old flow. After this migration, remove it from version control once with:

```powershell
git rm -r --cached _site
```

Then commit the result together with the new [`.gitignore`](/C:/Users/sante/OneDrive/Desktop/santerihukari.github.io/.gitignore).
