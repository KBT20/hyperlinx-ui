import {
  createCustomerTwinService,
  type CustomerTwinDomainFilters,
  type CustomerTwinRenderableState,
  type CustomerTwinState,
} from "./CustomerTwin";

export function projectCustomerTwinForRender(
  twin: CustomerTwinState | null | undefined,
  accountId: string,
  filters: CustomerTwinDomainFilters = {},
): CustomerTwinRenderableState {
  return createCustomerTwinService(twin).getRenderableTwinState(accountId, filters);
}
