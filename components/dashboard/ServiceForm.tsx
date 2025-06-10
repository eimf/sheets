"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    useAddServiceToCycleMutation,
    useUpdateServiceMutation,
    Service,
    NewService,
} from "@/lib/api";
import { useEffect } from "react";

const serviceSchema = z.object({
    name: z.string().min(1, "Service name is required"),
    price: z.coerce.number().min(0, "Price must be a positive number"),
    date: z.string().min(1, "Date is required"),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export interface ServiceFormProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service | null;
    currentCycleId: string;
}

export default function ServiceForm({
    isOpen,
    onClose,
    service,
    currentCycleId,
}: ServiceFormProps) {
    const [addServiceToCycle, { isLoading: isAdding }] =
        useAddServiceToCycleMutation();
    const [updateService, { isLoading: isUpdating }] =
        useUpdateServiceMutation();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ServiceFormData>({
        resolver: zodResolver(serviceSchema),
    });

    useEffect(() => {
        if (isOpen) {
            if (service) {
                reset({
                    name: service.name,
                    price: service.price,
                    date: service.date
                        ? new Date(service.date).toISOString().substring(0, 16)
                        : "",
                });
            } else {
                reset({
                    name: "",
                    price: 0,
                    date: new Date().toISOString().substring(0, 16),
                });
            }
        }
    }, [service, reset, isOpen]);

    const onSubmit = async (data: ServiceFormData) => {
        try {
            const serviceDetails: Omit<NewService, 'cycleId' | 'userId'> = {
                ...data,
                date: new Date(data.date).toISOString(),
            };

            if (service) {
                await updateService({
                    id: service.id,
                    ...serviceDetails,
                }).unwrap();
                toast.success("Service updated successfully!");
            } else {
                await addServiceToCycle({
                    cycleId: currentCycleId,
                    serviceDetails,
                }).unwrap();
                toast.success("Service added successfully!");
            }
            onClose();
        } catch (err) {
            console.error("Failed to save service:", err);
            toast.error("An error occurred. Please try again.");
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {service ? "Edit Service" : "Add New Service"}
                    </DialogTitle>
                    <DialogDescription>
                        {service
                            ? "Update the details of the service."
                            : "Add a new service to the current cycle."}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4 pt-4"
                >
                    <div>
                        <Label htmlFor="name">Service Name</Label>
                        <Input
                            id="name"
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
                        <Label htmlFor="price">Price</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            {...register("price")}
                            placeholder="e.g., 50.00"
                        />
                        {errors.price && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.price.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="date">Date & Time</Label>
                        <Input
                            id="date"
                            type="datetime-local"
                            {...register("date")}
                        />
                        {errors.date && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.date.message}
                            </p>
                        )}
                    </div>
                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isAdding || isUpdating}>
                            {isAdding || isUpdating
                                ? "Saving..."
                                : "Save Service"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
