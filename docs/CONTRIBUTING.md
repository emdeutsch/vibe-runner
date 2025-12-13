# Contributing to viberunner

Thank you for your interest in contributing to viberunner! This document provides guidelines for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Set up the development environment (see [SETUP.md](SETUP.md))
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(api): add endpoint for batch HR ingestion`
- `fix(worker): handle GitHub API rate limiting`
- `docs(readme): update setup instructions`

### Code Style

- TypeScript: Follow existing patterns, use strict mode
- Swift: Follow Swift style guide, use SwiftFormat
- Bash: Use shellcheck, follow Google style guide

### Testing

- Add tests for new functionality
- Ensure existing tests pass
- Test on real devices when possible (especially watchOS)

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Update CHANGELOG.md if applicable
4. Request review from maintainers

### PR Description Template

```markdown
## Description
[What does this PR do?]

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactor

## Testing
[How was this tested?]

## Screenshots
[If applicable]

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG updated (if applicable)
```

## Architecture Decisions

Major architecture decisions should be discussed in issues before implementation. Consider:

- Security implications
- Performance impact
- Backwards compatibility
- Maintenance burden

## Security

If you discover a security vulnerability, please report it privately to the maintainers rather than opening a public issue.

## Questions?

Open a discussion or issue if you have questions about contributing.
