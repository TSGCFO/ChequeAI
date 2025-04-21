import { useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface DocumentProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentProcessingModal({ isOpen, onClose }: DocumentProcessingModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractOptions, setExtractOptions] = useState({
    extractChequeNumber: true,
    extractAmount: true,
    extractDate: true,
    autoAssignCustomer: false,
  });
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file type
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a JPG, PNG, or PDF file.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "File size should not exceed 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check file type
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (!validTypes.includes(droppedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a JPG, PNG, or PDF file.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 10MB)
      if (droppedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "File size should not exceed 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleProcessDocument = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to process.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append("document", file);
      
      // Determine which endpoint to use based on the file type
      const isAIChequeProcessingEnabled = true; // Set to true to use AI processing 
      const endpoint = isAIChequeProcessingEnabled 
        ? "/api/process-cheque"  // AI-powered processing
        : "/api/process-document"; // Traditional OCR processing
      
      // For traditional OCR, add extraction options
      if (!isAIChequeProcessingEnabled) {
        Object.entries(extractOptions).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process document: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Display appropriate message based on the endpoint used
      if (isAIChequeProcessingEnabled) {
        toast({
          title: "Cheque processed with AI",
          description: "The AI assistant is now ready to help you complete the transaction.",
        });
        
        // The AI system now has the conversation data and will handle the rest in the chat interface
        // Set two localStorage items to pass data to the ChatInterface component
        window.localStorage.setItem('currentConversationId', result.conversationId);
        window.localStorage.setItem('lastProcessedDocument', 'true');
      } else {
        toast({
          title: "Document processed successfully",
          description: "The document was processed and information was extracted.",
        });
        
        // Traditional processing would return the extracted data directly
        console.log("Extracted data:", result);
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error("Error processing document:", error);
      toast({
        title: "Processing failed",
        description: "There was an error processing the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptionChange = (option: keyof typeof extractOptions) => {
    setExtractOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const resetForm = () => {
    setFile(null);
    setExtractOptions({
      extractChequeNumber: true,
      extractAmount: true,
      extractDate: true,
      autoAssignCustomer: false,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Process Document</DialogTitle>
        </DialogHeader>

        <div
          className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {file ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setFile(null)}
              >
                Change File
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-center">
                <Upload className="h-10 w-10 text-gray-400" />
              </div>
              <p className="mb-2 text-sm">Drag and drop a cheque image or PDF</p>
              <p className="text-xs text-gray-500">Supports JPG, PNG, and PDF files up to 10MB</p>
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileChange}
                  />
                  <Button type="button" variant="default" size="sm">
                    Browse Files
                  </Button>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Processing Options</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="extract-cheque-number"
                checked={extractOptions.extractChequeNumber}
                onCheckedChange={() => handleOptionChange("extractChequeNumber")}
              />
              <Label htmlFor="extract-cheque-number">Extract cheque number</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="extract-amount"
                checked={extractOptions.extractAmount}
                onCheckedChange={() => handleOptionChange("extractAmount")}
              />
              <Label htmlFor="extract-amount">Extract amount</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="extract-date"
                checked={extractOptions.extractDate}
                onCheckedChange={() => handleOptionChange("extractDate")}
              />
              <Label htmlFor="extract-date">Extract date</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-assign-customer"
                checked={extractOptions.autoAssignCustomer}
                onCheckedChange={() => handleOptionChange("autoAssignCustomer")}
              />
              <Label htmlFor="auto-assign-customer">Auto-assign customer</Label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleProcessDocument}
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Processing...
              </>
            ) : (
              "Process Document"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
