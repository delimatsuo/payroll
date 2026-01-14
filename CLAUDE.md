# Escala Simples - Project Guidelines

## Overview
Escala Simples é um sistema de agendamento de escalas para restaurantes e varejo no Brasil. O produto é inspirado na experiência do Nubank - simples, elegante e focado no usuário.

---

## Development Workflow

**Always use `npm`, not `yarn` or `pnpm`.**

### 1. Make changes

### 2. Typecheck (fast)
```bash
# Mobile
cd apps/mobile && npx tsc --noEmit

# API
cd apps/api && npx tsc --noEmit
```

### 3. Run tests
```bash
# Single test file
npm test -- --testPathPattern="filename"

# All tests
npm test
```

### 4. Lint before committing
```bash
npm run lint
```

### 5. Before creating PR
```bash
npm run lint && npm run typecheck && npm test
```

---

## Verification (CRITICAL)

**Give Claude a way to verify its work. This 2-3x the quality of the final result.**

### For Mobile App Changes
1. Run the app: `cd apps/mobile && npx expo start`
2. Test the specific screen/feature modified
3. Check for TypeScript errors: `npx tsc --noEmit`
4. Verify on both iOS and Android if possible

### For API Changes
1. Start the server: `cd apps/api && npm run dev`
2. Test endpoints with curl or the mobile app
3. Check Firestore for correct data persistence
4. Verify error handling with invalid inputs

### For WhatsApp Integration
1. Check API logs for WhatsApp API responses
2. Verify message delivery status
3. Test with a real phone number in development

---

## Common Mistakes to Avoid

**Add new mistakes here when you see Claude do something incorrectly.**

### Code Style
- DO NOT use `enum` - use string literal unions instead: `type Status = 'pending' | 'active'`
- DO NOT use `interface` for simple types - prefer `type`
- DO NOT keep old code around as "backwards compatibility" if not being used
- DO NOT add comments explaining obvious code
- DO NOT create abstraction layers for one-time operations

### React Native
- DO NOT use `StyleSheet.create` for dynamic styles - use inline objects
- DO NOT forget Haptic feedback on interactive elements
- DO NOT use smaller than 44pt touch targets
- DO NOT forget to handle loading and error states

### API
- DO NOT return English error messages - always Portuguese for user-facing errors
- DO NOT forget to validate request body with Zod schemas
- DO NOT expose internal error details to clients
- DO NOT forget authentication middleware on protected routes

### Firebase
- DO NOT store sensitive data unencrypted
- DO NOT forget to handle Firestore timestamp conversion
- DO NOT use `await` inside loops for Firestore operations - use batch writes

---

## Language & Localization
- **Interface**: 100% em Português Brasileiro
- **Código**: Inglês (variáveis, funções, comentários técnicos)
- **Mensagens de erro**: Português Brasileiro
- **Documentação técnica**: Inglês ou Português

---

## Tech Stack

### Mobile App (`apps/mobile`)
- React Native + Expo (SDK 52)
- expo-router para navegação
- TypeScript
- Firebase Authentication (@react-native-firebase/auth)
- expo-haptics para feedback tátil
- expo-blur para efeitos visuais
- react-native-reanimated para animações

### Backend (`apps/api`)
- Node.js + Express
- Firebase Admin SDK
- Firestore Database
- TypeScript
- Zod para validação

### Infrastructure
- GCP Project: `escala-simples-482616`
- Firebase Authentication (Email/Password + Google)
- Firestore para dados
- WhatsApp Business Cloud API

### AI/LLM
- **Gemini 2.5 Flash** (latest stable) - EXCLUSIVAMENTE
- Usado para: extração de dados, NLP, geração de escalas
- NÃO usar outros modelos (Claude, GPT, etc) no backend

### GCP Cost Optimization (Development)
- Use o MÍNIMO de recursos possível durante desenvolvimento
- Preferir Firestore em modo "test" ou emulator local
- Cloud Run: mínimo de instâncias (0-1)
- Cloud Functions: evitar triggers desnecessários
- Gemini: usar cache quando possível, batch requests
- Monitorar billing alerts

---

## Design System - Apple Human Interface Guidelines

**IMPORTANTE**: Todo o design do app DEVE seguir os princípios da Apple Human Interface Guidelines (HIG).

### Typography
Usar a escala de tipografia do iOS:
- `largeTitle` (34pt): Títulos principais de tela
- `title1` (28pt): Títulos de seção importantes
- `title2` (22pt): Subtítulos
- `title3` (20pt): Títulos menores
- `headline` (17pt): Títulos de células/cards
- `body` (17pt): Texto principal
- `subhead` (15pt): Texto secundário
- `footnote` (13pt): Notas e labels pequenos
- `caption1` (12pt): Captions
- `caption2` (11pt): Captions menores

### Colors
- Usar iOS System Colors (`colors.system.*`)
- Backgrounds em camadas (`primary`, `secondary`, `grouped`, `elevated`)
- Texto hierárquico (`primary`, `secondary`, `tertiary`, `quaternary`)
- Cores semânticas (`success`, `warning`, `error`, `info`)

### Spacing
- Sistema de grid de 8pt
- Usar tokens: `xxs(2)`, `xs(4)`, `sm(8)`, `md(16)`, `lg(24)`, `xl(32)`, `xxl(48)`, `xxxl(64)`

### Components & Patterns
1. **Large Titles**: Todas as telas principais devem ter título grande no header
2. **Haptic Feedback**:
   - `Light`: Navegação, seleção de itens
   - `Medium`: Ações importantes (submit, delete)
   - `Selection`: Seleção de data/hora
   - `Notification`: Confirmações de sucesso/erro
3. **Pressable States**: Usar `Pressable` com feedback visual (opacity, scale)
4. **Cards**: Bordas arredondadas (16pt), sombras sutis
5. **Lists**: Separadores alinhados ao conteúdo, não full-width
6. **Modals**: iOS-style com handle, header com Cancel/Done
7. **Tab Bar**: Blur effect no iOS, ícones outline/filled baseado em estado
8. **Grouped Tables**: Para telas de configurações (Settings style)

### Animations
- Spring animations para modais e transições
- Durations: `fast(150ms)`, `normal(250ms)`, `slow(400ms)`
- Usar `react-native-reanimated` para animações complexas

### Touch Targets
- Mínimo 44pt para áreas tocáveis (Apple guideline)
- Usar `hitSlop` quando necessário

---

## Code Standards

### File Structure
```
apps/
  mobile/
    app/           # expo-router pages
    src/
      components/  # Componentes reutilizáveis
      hooks/       # Custom hooks
      services/    # API calls, Firebase
      theme/       # Design tokens
      types/       # TypeScript types
      utils/       # Helpers
  api/
    src/
      routes/      # Express routes
      middleware/  # Auth, validation
      services/    # Business logic
      types/       # TypeScript types
```

### Naming Conventions
- Components: PascalCase (`EmployeeCard.tsx`)
- Hooks: camelCase com prefixo "use" (`useEstablishment.ts`)
- Utils: camelCase (`formatDate.ts`)
- Types: PascalCase (`Employee`, `Establishment`)
- API routes: kebab-case (`/employees/send-bulk`)

### TypeScript Patterns
```typescript
// Prefer type over interface for simple types
type Status = 'pending' | 'active' | 'inactive';

// Use type for object shapes
type Employee = {
  id: string;
  name: string;
  status: Status;
};

// Use Zod for runtime validation
const EmployeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^\d{10,11}$/),
});
```

### React Native Patterns
```tsx
// Always use Pressable with feedback
<Pressable
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handlePress();
  }}
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
  ]}
>
  <Text>Button</Text>
</Pressable>

// Handle all states
{isLoading ? (
  <ActivityIndicator />
) : error ? (
  <ErrorMessage message={error} />
) : (
  <Content data={data} />
)}
```

### State Management
- React Context para estado global (Auth, Establishment)
- useState/useReducer para estado local
- Evitar prop drilling excessivo

---

## Firebase Collections

```
establishments/
  {establishmentId}/
    name: string
    type: 'restaurant' | 'store' | 'bar' | 'other'
    ownerId: string
    operatingHours: { [day: number]: { isOpen, openTime, closeTime } }
    settings: { minEmployeesPerShift, swapsAllowed, ... }
    status: 'pending' | 'active'
    onboardingStep: number
    createdAt, updatedAt: Timestamp

employees/
  {employeeId}/
    establishmentId: string
    name: string
    phone: string
    status: 'pending' | 'active' | 'inactive'
    inviteStatus: 'pending' | 'sent' | 'completed' | 'expired'
    inviteSentAt: Timestamp
    inviteToken: string
    restrictions: { unavailableDays, unavailableTimeRanges, ... }
    createdAt, updatedAt: Timestamp

invites/
  {inviteToken}/
    employeeId: string
    establishmentId: string
    token: string
    createdAt, expiresAt: Timestamp
    used: boolean
    usedAt?: Timestamp

schedules/
  {scheduleId}/
    establishmentId: string
    weekStart: string (YYYY-MM-DD)
    shifts: Shift[]
    status: 'draft' | 'published'
    createdAt, updatedAt: Timestamp
```

---

## API Endpoints

### Authentication
```
POST   /auth/register     - Criar conta
POST   /auth/login        - Login
```

### Establishment
```
GET    /establishment              - Dados do estabelecimento
POST   /establishment              - Criar estabelecimento
PUT    /establishment              - Atualizar estabelecimento
PATCH  /establishment/operating-hours - Atualizar horários
PATCH  /establishment/settings     - Atualizar configurações
POST   /establishment/activate     - Ativar após onboarding
```

### Employees
```
GET    /employees         - Listar funcionários
POST   /employees         - Adicionar funcionário
POST   /employees/batch   - Adicionar vários funcionários
PUT    /employees/:id     - Atualizar funcionário
DELETE /employees/:id     - Remover funcionário
```

### Invites
```
POST   /invites/send              - Enviar convite via WhatsApp
POST   /invites/send-bulk         - Enviar convites em lote
POST   /invites/resend/:id        - Reenviar convite
GET    /invites/validate/:token   - Validar token (público)
POST   /invites/submit-restrictions - Submeter restrições (público)
```

### Schedules
```
POST   /schedules/generate - Gerar escala com IA
GET    /schedules         - Listar escalas
PUT    /schedules/:id     - Atualizar escala
POST   /schedules/:id/publish - Publicar escala
```

### Chat (Onboarding Conversacional)
```
POST   /chat/start        - Iniciar sessão de chat
POST   /chat/message      - Enviar mensagem
GET    /chat/session/:id  - Recuperar sessão (reconexão)
POST   /chat/action       - Ação de botão/componente
POST   /chat/skip         - Pular para CRUD tradicional
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}
```

### Error Response
```json
{
  "success": false,
  "error": "ErrorCode",
  "message": "Mensagem em português para o usuário",
  "details": { ... }  // Optional, for validation errors
}
```

---

## Git Workflow
- Branch principal: `main`
- Feature branches: `feature/nome-da-feature`
- Commits em português ou inglês, consistentes
- PRs com descrição clara do que foi feito

### PR Template
```markdown
## Resumo
- O que foi feito

## Tipo de mudança
- [ ] Nova feature
- [ ] Bug fix
- [ ] Refatoração
- [ ] Documentação

## Como testar
1. Passo 1
2. Passo 2

## Screenshots (se aplicável)
```

---

## Testing
- Jest para unit tests
- React Native Testing Library para componentes
- Testar em iOS Simulator e Android Emulator
- Sempre verificar TypeScript antes de commitar

---

## Performance Guidelines
- Lazy loading para telas pesadas
- Memoização com `useMemo`/`useCallback` quando apropriado
- Evitar re-renders desnecessários
- Otimizar listas com `FlatList` e `keyExtractor`
- Batch Firestore operations quando possível

---

## Route Structure (Mobile App)

```
apps/mobile/app/
├── _layout.tsx              # Root layout
├── index.tsx                # Splash/auth routing
├── (auth)/                  # Manager authentication
│   ├── login.tsx            # Has "Sou funcionário" link
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (onboarding)/            # Manager onboarding (5 steps)
├── (tabs)/                  # Manager main app (authenticated)
│   ├── index.tsx            # Dashboard
│   ├── team.tsx             # Team management
│   ├── schedule.tsx         # Schedule view
│   └── settings.tsx         # AI chat settings
└── (employee)/              # Employee screens (separate auth)
    ├── login.tsx            # OTP login
    ├── home.tsx             # Employee dashboard
    └── availability.tsx     # Set availability
```

### Authentication Flow
- **Managers:** Firebase Auth (email/password) → `(tabs)/`
- **Employees:** OTP via WhatsApp → `(employee)/`
- Splash screen (`index.tsx`) checks both auth states and routes accordingly

---

## Environment Variables

### API (.env)
```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:8081
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_BUSINESS_ACCOUNT_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
GEMINI_API_KEY=xxx
APP_URL=https://escala-simples.com
```

### Mobile
API URL is configured in `apps/mobile/src/services/api.ts`:
- Development: `http://localhost:3001`
- Production: `https://api.escalasimples.com.br`

---

## Troubleshooting

### Common Development Issues

| Issue | Solution |
|-------|----------|
| `EADDRINUSE: port 3001` | `lsof -i :3001` then `kill <PID>` |
| `EADDRINUSE: port 8081` | `lsof -i :8081` then `kill <PID>` |
| App stuck on "Carregando..." | Check if API is running (`curl localhost:3001/health`) |
| "Query requires index" | Deploy indexes: `npx firebase deploy --only firestore:indexes` |
| React version mismatch | Already fixed with `overrides` in root package.json |
| expo-router types not found | Use `as Href` cast: `router.push('/(tabs)' as Href)` |

### Verify Services Running
```bash
# API health check
curl http://localhost:3001/health

# Find processes on ports
lsof -i :3001
lsof -i :8081

# Kill all project node processes (careful!)
pkill -f "node.*escala-simples"
```

---

## Quick Reference

### Brazilian Phone Formatting
```typescript
// Input: (11) 99999-9999 or 11999999999
// Output: 5511999999999
function formatPhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (!digits.startsWith('55')) digits = '55' + digits;
  return digits;
}
```

### Phone Input Mask
```typescript
// Display format: (XX) XXXXX-XXXX
function formatPhoneDisplay(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
}
```

### Days of Week (Portuguese)
```typescript
const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// Index matches JavaScript Date.getDay() (0 = Sunday)
```

---

## Ralph Framework Integration

This project uses the Ralph autonomous development methodology. Key files:
- `PROMPT.md` - Development instructions and context
- `@fix_plan.md` - Prioritized task list (the @ prefix means Ralph control file)
- `CLAUDE.md` - This file, serves as @AGENT.md equivalent
- `specs/requirements.md` - Technical specifications

### Feature Development Quality Standards

**CRITICAL**: All new features MUST meet the following mandatory requirements before being considered complete.

#### Testing Requirements
- **Minimum Coverage**: 85% code coverage ratio required for all new code
- **Test Pass Rate**: 100% - all tests must pass, no exceptions
- **Coverage Validation**: Run coverage reports before marking features complete:
  ```bash
  npm run test:coverage
  ```

#### Git Workflow Requirements

Before moving to the next feature, ALL changes must be:

1. **Committed with Clear Messages**:
   ```bash
   git add .
   git commit -m "feat(module): descriptive message following conventional commits"
   ```
   - Use conventional commit format: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
   - Include scope when applicable: `feat(api):`, `fix(mobile):`, `test(auth):`

2. **Pushed to Remote Repository**:
   ```bash
   git push origin <branch-name>
   ```

3. **Branch Hygiene**:
   - Work on feature branches, never directly on `main`
   - Branch naming: `feature/<name>`, `fix/<name>`, `docs/<name>`

#### Feature Completion Checklist

Before marking ANY feature as complete in @fix_plan.md, verify:

- [ ] All tests pass
- [ ] Code coverage meets 85% minimum (for new code)
- [ ] TypeScript strict mode passes (`npx tsc --noEmit`)
- [ ] Code formatted and linted (`npm run lint`)
- [ ] All changes committed with conventional commits
- [ ] All commits pushed to remote
- [ ] @fix_plan.md task marked as `[x]`
- [ ] handover.md updated if significant change

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `PROMPT.md` | Ralph development instructions |
| `@fix_plan.md` | Prioritized TODO list with progress |
| `handover.md` | AI agent handover context |
| `specs/requirements.md` | Technical specifications from PRD |
| `PRD.md` (parent folder) | Full product requirements |
