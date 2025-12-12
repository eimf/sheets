"use client";

import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    useCreateServiceMutation,
    useUpdateServiceMutation,
    useGetCycleQuery,
    Service,
    NewService,
    Cycle,
} from "@/lib/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useSelector } from "react-redux";
import { selectAuth } from "@/lib/slices/authSlice";
import { cn } from "@/lib/utils";

const paymentMethods = [
    { value: "card", label: "Card" },
    { value: "cash", label: "Cash" },
    { value: "cashapp", label: "CashApp" },
    { value: "zelle", label: "Zelle" },
    { value: "other", label: "Other" },
];

const paymentDetailSchema = z.object({
    method: z.enum(["card", "cash", "cashapp", "zelle", "other"]),
    amount: z.coerce.number().min(0, "Amount must be positive"),
    label: z.string().optional(),
});

// Create a schema factory that accepts cycle date range for validation
const createServiceSchema = (
    startDate?: string,
    endDate?: string,
    isAdmin?: boolean
) => {
    return z
        .object({
            name: z.string().min(2, "Name must be at least 2 characters."),
            customer: z
                .string()
                .min(2, "Customer must be at least 2 characters.")
                .optional(),
            price: z.coerce.number().min(0, "Price must be a positive number."),
            tip: z.coerce
                .number()
                .min(0, "Tip must be a positive number.")
                .optional(),
            notes: z
                .string()
                .max(500, "Notes must be under 500 characters.")
                .optional(),
            payments: z
                .array(paymentDetailSchema)
                .nonempty()
                .refine((arr) => {
                    const total = arr.reduce((s, p) => s + p.amount, 0);
                    return !isNaN(total);
                }, "Invalid payments"),
            date: z
                .string()
                .refine((val) => !isNaN(Date.parse(val)), {
                    message: "Invalid date",
                })
                .refine(
                    (val) => {
                        // Skip cycle date validation for admin users
                        if (isAdmin) return true;
                        if (!startDate || !endDate) return true; // Skip validation if cycle dates not available
                        const serviceDate = val; // YYYY-MM-DD format
                        return (
                            serviceDate >= startDate && serviceDate <= endDate
                        );
                    },
                    {
                        message: `Service date must be within the cycle date range (${startDate} to ${endDate})`,
                    }
                ),
        })
        .refine(
            (data) => {
                const total = data.payments.reduce((s, p) => s + p.amount, 0);
                return total === data.price;
            },
            {
                message: "Payment amounts must sum to Price",
                path: ["payments"],
            }
        );
};

type ServiceFormData = z.infer<ReturnType<typeof createServiceSchema>>;

export interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service | null;
    currentCycleId: string;
    allowCycleSelection?: boolean;
    availableCycles?: Cycle[];
}

export default function ServiceForm({
    isOpen,
    onClose,
    service,
    currentCycleId,
    allowCycleSelection = false,
    availableCycles = [],
}: ServiceFormProps) {
    const [createService, { isLoading: isAdding }] = useCreateServiceMutation();
    const [updateService, { isLoading: isUpdating }] =
        useUpdateServiceMutation();
    const [selectedCycleId, setSelectedCycleId] =
        useState<string>(currentCycleId);
    const auth = useSelector(selectAuth);
    const isAdmin = auth.user?.role === "admin";
    const isStylish = auth.user?.role === "user";

    // Fetch the selected cycle to get date range for validation
    const { data: selectedCycle } = useGetCycleQuery(selectedCycleId, {
        skip: !selectedCycleId,
    });

    // Get cycle dates for validation
    const cycleStartDate = selectedCycle?.startDate;
    const cycleEndDate = selectedCycle?.endDate;

    // Store latest cycle dates in refs so validation can access current values
    // This allows the resolver to use the latest cycle dates even though it's created once
    const cycleStartDateRef = useRef(cycleStartDate);
    const cycleEndDateRef = useRef(cycleEndDate);
    const isAdminRef = useRef(isAdmin);

    useEffect(() => {
        cycleStartDateRef.current = cycleStartDate;
        cycleEndDateRef.current = cycleEndDate;
        isAdminRef.current = isAdmin;
    }, [cycleStartDate, cycleEndDate, isAdmin]);

    // Create resolver that uses refs to access latest cycle dates for validation
    const resolver = useMemo(
        () =>
            zodResolver(
                z
                    .object({
                        name: z
                            .string()
                            .min(2, "Name must be at least 2 characters."),
                        customer: z
                            .string()
                            .min(2, "Customer must be at least 2 characters.")
                            .optional(),
                        price: z.coerce
                            .number()
                            .min(0, "Price must be a positive number."),
                        tip: z.coerce
                            .number()
                            .min(0, "Tip must be a positive number.")
                            .optional(),
                        notes: z
                            .string()
                            .max(500, "Notes must be under 500 characters.")
                            .optional(),
                        payments: z
                            .array(
                                z.object({
                                    method: z.enum([
                                        "card",
                                        "cash",
                                        "cashapp",
                                        "zelle",
                                        "other",
                                    ]),
                                    amount: z.coerce
                                        .number()
                                        .min(0, "Amount must be positive"),
                                    label: z.string().optional(),
                                })
                            )
                            .nonempty()
                            .refine((arr) => {
                                const total = arr.reduce(
                                    (s, p) => s + p.amount,
                                    0
                                );
                                return !isNaN(total);
                            }, "Invalid payments"),
                        date: z
                            .string()
                            .refine((val) => !isNaN(Date.parse(val)), {
                                message: "Invalid date",
                            })
                            .refine(
                                (val) => {
                                    // Access latest cycle dates from refs for dynamic validation
                                    if (isAdminRef.current) return true;
                                    const startDate = cycleStartDateRef.current;
                                    const endDate = cycleEndDateRef.current;
                                    if (!startDate || !endDate) return true;
                                    const serviceDate = val;
                                    return (
                                        serviceDate >= startDate &&
                                        serviceDate <= endDate
                                    );
                                },
                                (val) => {
                                    // Dynamic error message using current cycle dates
                                    const startDate = cycleStartDateRef.current;
                                    const endDate = cycleEndDateRef.current;
                                    return {
                                        message: `Service date must be within the cycle date range (${
                                            startDate || "N/A"
                                        } to ${endDate || "N/A"})`,
                                    };
                                }
                            ),
                    })
                    .refine(
                        (data) => {
                            const total = data.payments.reduce(
                                (s, p) => s + p.amount,
                                0
                            );
                            return total === data.price;
                        },
                        {
                            message: "Payment amounts must sum to Price",
                            path: ["payments"],
                        }
                    )
            ),
        [] // Empty deps - resolver uses refs that are always current
    );

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
        setValue,
        trigger,
        setError,
    } = useForm<ServiceFormData>({
        resolver,
        mode: "onChange", // Validate on change to catch cycle date violations immediately
    });

    // Re-validate date field when cycle changes
    useEffect(() => {
        if (cycleStartDate && cycleEndDate) {
            trigger("date");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cycleStartDate, cycleEndDate]); // trigger is stable from react-hook-form

    const { fields, append, remove } = useFieldArray({
        control,
        name: "payments",
    });

    // Track if we've reset for the current open state to prevent loops
    const hasResetForOpenRef = useRef(false);
    const lastServiceIdRef = useRef<string | null>(null);
    const lastIsOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            const serviceId = service?.id ? String(service.id) : null;
            const needsReset =
                !lastIsOpenRef.current || // Dialog just opened
                lastServiceIdRef.current !== serviceId; // Service changed

            if (needsReset) {
                if (service) {
                    reset({
                        name: service.name,
                        customer: service.customer || "",
                        price: service?.price || 0,
                        tip: service?.tip || 0,
                        notes: service?.notes || "",
                        payments:
                            service.payments && service.payments.length > 0
                                ? service.payments
                                : [{ method: "card", amount: service.price }],
                        date: service.date
                            ? new Date(service.date).toISOString().split("T")[0]
                            : "",
                    });
                    // Set cycle ID for editing - always set when allowCycleSelection is enabled
                    if (allowCycleSelection) {
                        setSelectedCycleId(
                            service.cycleId ||
                                currentCycleId ||
                                (availableCycles?.[0]
                                    ? String(availableCycles[0].id)
                                    : "")
                        );
                    }
                } else {
                    reset({
                        name: "",
                        customer: "",
                        price: 0,
                        tip: 0,
                        notes: "",
                        payments: [{ method: "card", amount: 0 }],
                        date: new Date().toISOString().split("T")[0],
                    });
                    setSelectedCycleId(
                        allowCycleSelection
                            ? currentCycleId ||
                                  (availableCycles?.[0]
                                      ? String(availableCycles[0].id)
                                      : "")
                            : currentCycleId
                    );
                }
            }

            // Update refs after reset
            lastServiceIdRef.current = serviceId;
            hasResetForOpenRef.current = true;
        } else {
            // Reset flags when dialog closes
            hasResetForOpenRef.current = false;
            lastServiceIdRef.current = null;
        }
        lastIsOpenRef.current = isOpen;
    }, [
        service,
        isOpen,
        allowCycleSelection,
        currentCycleId,
        availableCycles,
        reset,
    ]);

    // If cycle selection is enabled and no cycle is selected, default to the first available cycle
    useEffect(() => {
        if (!isOpen) return;
        if (!allowCycleSelection) return;
        if (selectedCycleId) return;
        if (availableCycles && availableCycles.length > 0) {
            setSelectedCycleId(String(availableCycles[0].id));
        }
    }, [isOpen, allowCycleSelection, selectedCycleId, availableCycles]);

    const paymentsWatch = useWatch({ control, name: "payments" });
    const currentPriceRef = useRef<number>(0);
    useEffect(() => {
        const total = (paymentsWatch || []).reduce(
            (s, p) => s + (parseFloat(String(p.amount)) || 0),
            0
        );
        const newPrice = Number.isFinite(total) ? total : 0;
        // Only update if price actually changed to prevent loops
        if (currentPriceRef.current !== newPrice) {
            currentPriceRef.current = newPrice;
            setValue("price", newPrice, {
                shouldValidate: false,
                shouldDirty: true,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentsWatch]); // setValue is stable from react-hook-form

    const onSubmit = async (data: ServiceFormData) => {
        // Final validation: ensure service date is within cycle date range (only for stylish users)
        if (!isAdmin && cycleStartDate && cycleEndDate) {
            const serviceDate = data.date; // YYYY-MM-DD format
            if (serviceDate < cycleStartDate || serviceDate > cycleEndDate) {
                setError("date", {
                    type: "manual",
                    message: `Service date must be within the cycle date range (${cycleStartDate} to ${cycleEndDate})`,
                });
                toast.error(
                    `Service date must be within the cycle date range (${cycleStartDate} to ${cycleEndDate})`
                );
                return;
            }
        }

        try {
            const serviceDetails: Omit<NewService, "cycleId" | "userId"> = {
                ...data,
                date: new Date(data.date).toISOString(),
            };

            if (service) {
                // Ensure service ID is valid
                if (!service.id) {
                    toast.error(
                        "Service ID is missing. Cannot update service."
                    );
                    return;
                }
                if (allowCycleSelection && !selectedCycleId) {
                    toast.error("Please select a cycle.");
                    return;
                }
                // Always include cycleId in update - use selected cycle if allowed, otherwise use service's current cycle
                const updateData: any = {
                    id: String(service.id), // Ensure ID is a string
                    ...serviceDetails,
                    cycleId: allowCycleSelection
                        ? selectedCycleId
                        : service.cycleId || currentCycleId,
                };
                await updateService(updateData).unwrap();
                toast.success("Service updated successfully!");
            } else {
                if (allowCycleSelection && !selectedCycleId) {
                    toast.error("Please select a cycle.");
                    return;
                }
                await createService({
                    ...serviceDetails,
                    cycleId: allowCycleSelection
                        ? selectedCycleId
                        : currentCycleId,
                }).unwrap();
                toast.success("Service added successfully!");
            }
            onClose();
        } catch (err: any) {
            console.error("Failed to save service:", err);
            const errorMessage =
                err?.data?.error ||
                err?.data?.message ||
                err?.message ||
                "An error occurred. Please try again.";
            toast.error(`Failed to save service: ${errorMessage}`);
        }
    };

    // Store onClose in a ref to avoid dependency issues
    const onCloseRef = useRef(onClose);
    const isClosingRef = useRef(false);
    const prevIsOpenRef = useRef(isOpen);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Track previous isOpen to detect actual changes
    useEffect(() => {
        prevIsOpenRef.current = isOpen;
        if (isOpen) {
            isClosingRef.current = false;
        }
    }, [isOpen]);

    // Handle browser back button: close dialog instead of navigating away
    useEffect(() => {
        if (!isOpen) {
            // Reset closing flag when dialog is closed
            isClosingRef.current = false;
            return;
        }

        // Reset closing flag when dialog opens
        isClosingRef.current = false;

        const handlePopState = () => {
            if (!isClosingRef.current) {
                isClosingRef.current = true;
                onCloseRef.current();
            }
        };

        // push a dummy state so the first back closes the dialog
        const hasPushedState = window.history.state?.serviceModalOpen;
        if (!hasPushedState) {
            window.history.pushState({ serviceModalOpen: true }, "");
        }

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
            // Only go back if we pushed the state (check before cleanup runs)
            // Use a flag to track if we need to clean up history
            const shouldCleanupHistory = window.history.state?.serviceModalOpen;
            if (shouldCleanupHistory) {
                // Use setTimeout to avoid state updates during render
                setTimeout(() => {
                    // Double-check the state still exists before going back
                    if (window.history.state?.serviceModalOpen) {
                        window.history.back();
                    }
                }, 0);
            }
        };
    }, [isOpen]);

    // Memoize onOpenChange to prevent unnecessary re-renders
    // Only call onClose if dialog is actually open and being closed by user action
    const handleOpenChange = useCallback(
        (open: boolean) => {
            // Only respond if:
            // 1. Dialog is being closed (open === false)
            // 2. Dialog was actually open (prevIsOpenRef.current === true, not just isOpen)
            // 3. We're not already closing
            // This prevents responding to stale callbacks or duplicate events
            if (!open && prevIsOpenRef.current && !isClosingRef.current) {
                isClosingRef.current = true;
                onCloseRef.current();
            }
        },
        [] // No dependencies - uses refs that are always current
    );

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="sticky top-0 z-20 bg-white border-b flex flex-col gap-2 py-2 px-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <DialogTitle>
                            {service ? "Edit Service" : "Add New Service"}
                        </DialogTitle>
                        <DialogDescription>
                            {service
                                ? "Update the details of the service."
                                : "Add a new service to the current cycle."}
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 sm:flex-none"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="serviceForm"
                            disabled={isAdding || isUpdating}
                            className="flex-1 sm:flex-none"
                        >
                            {isAdding || isUpdating ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogHeader>
                <form
                    id="serviceForm"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto px-4"
                >
                    {allowCycleSelection && availableCycles.length > 0 && (
                        <div>
                            <Label id="cycle-label">Cycle</Label>
                            <Select
                                value={selectedCycleId}
                                onValueChange={(newCycleId) => {
                                    setSelectedCycleId(newCycleId);
                                    // Re-validate date when cycle changes
                                    setTimeout(() => trigger("date"), 100);
                                }}
                            >
                                <SelectTrigger
                                    id="cycle-select"
                                    name="cycle"
                                    aria-labelledby="cycle-label"
                                >
                                    <SelectValue placeholder="Select a cycle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCycles.map((cycle) => (
                                        <SelectItem
                                            key={cycle.id}
                                            value={String(cycle.id)}
                                        >
                                            {cycle.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="name">Service</Label>
                        <Input
                            id="name"
                            name="name"
                            autoComplete="off"
                            {...register("name")}
                            placeholder="e.g., Haircut"
                        />
                        {errors.name && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.name.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="customer">Customer</Label>
                        <Input
                            id="customer"
                            name="customer"
                            autoComplete="name"
                            {...register("customer")}
                            placeholder="e.g., John Doe"
                        />
                        {errors.customer && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.customer.message}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="tip">Tip</Label>
                            <Input
                                id="tip"
                                name="tip"
                                type="number"
                                step="0.01"
                                autoComplete="off"
                                {...register("tip")}
                                placeholder="e.g., 10.00"
                            />
                            {errors.tip && (
                                <p className="text-red-500 text-sm mt-1">
                                    {errors.tip.message}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label id="date-label">Date</Label>
                            <Controller
                                name="date"
                                control={control}
                                rules={{
                                    validate: (value) => {
                                        if (!value) {
                                            return "Date is required";
                                        }
                                        // Skip cycle date validation for admin users
                                        if (isAdmin) {
                                            return true;
                                        }
                                        const dateStr =
                                            typeof value === "string"
                                                ? value
                                                : format(value, "yyyy-MM-dd");
                                        if (!cycleStartDate || !cycleEndDate) {
                                            return true; // Skip validation if cycle dates not available
                                        }
                                        if (
                                            dateStr < cycleStartDate ||
                                            dateStr > cycleEndDate
                                        ) {
                                            return `Service date must be within the cycle date range (${cycleStartDate} to ${cycleEndDate})`;
                                        }
                                        return true;
                                    },
                                }}
                                render={({ field }) => {
                                    const dateValue = field.value
                                        ? typeof field.value === "string"
                                            ? new Date(
                                                  field.value + "T00:00:00"
                                              )
                                            : field.value
                                        : undefined;

                                    // For stylish users, disable dates outside the cycle range
                                    const disabledDates =
                                        isStylish &&
                                        cycleStartDate &&
                                        cycleEndDate
                                            ? (date: Date) => {
                                                  const dateStr = format(
                                                      date,
                                                      "yyyy-MM-dd"
                                                  );
                                                  return (
                                                      dateStr <
                                                          cycleStartDate ||
                                                      dateStr > cycleEndDate
                                                  );
                                              }
                                            : undefined;

                                    return (
                                        <>
                                            <input
                                                type="hidden"
                                                id="date"
                                                name="date"
                                                value={field.value || ""}
                                                autoComplete="off"
                                            />
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        aria-labelledby="date-label"
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !dateValue &&
                                                                "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {dateValue ? (
                                                            format(
                                                                dateValue,
                                                                "MM/dd/yy"
                                                            )
                                                        ) : (
                                                            <span>
                                                                Pick a date
                                                            </span>
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="w-auto p-0"
                                                    align="start"
                                                >
                                                    <Calendar
                                                        mode="single"
                                                        selected={dateValue}
                                                        onSelect={(date) => {
                                                            if (date) {
                                                                const dateStr =
                                                                    format(
                                                                        date,
                                                                        "yyyy-MM-dd"
                                                                    );
                                                                field.onChange(
                                                                    dateStr
                                                                );
                                                                trigger("date");
                                                            }
                                                        }}
                                                        disabled={disabledDates}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </>
                                    );
                                }}
                            />
                            {errors.date && (
                                <p className="text-red-500 text-sm mt-1">
                                    {errors.date.message}
                                </p>
                            )}
                            {cycleStartDate && cycleEndDate && isStylish && (
                                <p className="text-gray-500 text-xs mt-1">
                                    Cycle range: {cycleStartDate} to{" "}
                                    {cycleEndDate}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="price">Price</Label>
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                step="0.01"
                                autoComplete="off"
                                {...register("price")}
                                disabled
                                className="bg-gray-100 cursor-not-allowed"
                            />
                        </div>
                    </div>
                    {/* Payments Section */}
                    <div>
                        <div className="text-sm font-medium leading-none mb-2">
                            Payment Methods
                        </div>
                        {paymentMethods.map((pm) => {
                            const idx = fields.findIndex(
                                (f) => f.method === pm.value
                            );
                            const checked = idx !== -1;
                            const checkboxId = `payment-${pm.value}`;
                            const amountId = `payment-${pm.value}-amount`;
                            const labelId = `payment-${pm.value}-label`;
                            return (
                                <div
                                    key={pm.value}
                                    className="flex items-center space-x-2 my-1"
                                >
                                    <input
                                        type="checkbox"
                                        id={checkboxId}
                                        name={`payment-${pm.value}`}
                                        checked={checked}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                append({
                                                    method: pm.value as any,
                                                    amount: 0,
                                                    label: "",
                                                });
                                            } else if (idx !== -1) {
                                                remove(idx);
                                            }
                                        }}
                                    />
                                    <Label
                                        htmlFor={checkboxId}
                                        className="cursor-pointer"
                                    >
                                        {pm.label}
                                    </Label>
                                    {checked && (
                                        <>
                                            <Input
                                                id={amountId}
                                                name={`payments.${idx}.amount`}
                                                type="number"
                                                step="0.01"
                                                autoComplete="off"
                                                className="w-24 ml-2"
                                                {...register(
                                                    `payments.${idx}.amount` as const
                                                )}
                                                placeholder="0.00"
                                            />
                                            {pm.value === "other" && (
                                                <Input
                                                    id={labelId}
                                                    name={`payments.${idx}.label`}
                                                    autoComplete="off"
                                                    className="ml-2"
                                                    placeholder="Specify method"
                                                    {...register(
                                                        `payments.${idx}.label` as const
                                                    )}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {errors.payments && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.payments.message as string}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            autoComplete="off"
                            {...register("notes")}
                            placeholder="Optional notes about the service"
                            rows={3}
                        />
                        {errors.notes && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.notes.message}
                            </p>
                        )}
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
