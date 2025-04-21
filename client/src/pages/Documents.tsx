import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, File, Search, Download, Trash2, FileText, FilePen } from "lucide-react";

export default function Documents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  
  // Sample document data
  const documents = [
    { 
      id: 1, 
      name: "Cheque #CH001 - Scan", 
      type: "image/jpeg", 
      size: "1.2 MB", 
      date: "2025-04-05", 
      category: "cheques",
      status: "processed"
    },
    { 
      id: 2, 
      name: "Vendor Agreement - Hassan", 
      type: "application/pdf", 
      size: "356 KB", 
      date: "2025-03-15", 
      category: "agreements",
      status: "active"
    },
    { 
      id: 3, 
      name: "Customer Contract - Sadaquat", 
      type: "application/pdf", 
      size: "512 KB", 
      date: "2025-03-10", 
      category: "contracts",
      status: "active"
    },
    { 
      id: 4, 
      name: "Cheque #CH002 - Scan", 
      type: "image/jpeg", 
      size: "980 KB", 
      date: "2025-04-10", 
      category: "cheques",
      status: "pending"
    },
    { 
      id: 5, 
      name: "Bank Statement - March 2025", 
      type: "application/pdf", 
      size: "1.5 MB", 
      date: "2025-04-02", 
      category: "statements",
      status: "archived"
    }
  ];
  
  // Filter documents based on search query and selected tab
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedTab === "all") return matchesSearch;
    if (selectedTab === "cheques") return matchesSearch && doc.category === "cheques";
    if (selectedTab === "contracts") return matchesSearch && (doc.category === "contracts" || doc.category === "agreements");
    if (selectedTab === "statements") return matchesSearch && doc.category === "statements";
    return matchesSearch;
  });
  
  const handleUpload = () => {
    // In a real app, this would open a file upload dialog
    toast({
      title: "Upload Feature",
      description: "File upload functionality would be implemented here."
    });
  };
  
  const handleDownload = (id: number) => {
    // In a real app, this would download the document
    toast({
      title: "Download Started",
      description: "Document download would start here."
    });
  };
  
  const handleDelete = (id: number) => {
    // In a real app, this would delete the document
    toast({
      title: "Document Deleted",
      description: "The document has been removed."
    });
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500">Manage and view your stored documents</p>
        </div>
        <Button onClick={handleUpload} className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>
      
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input 
            className="pl-10" 
            placeholder="Search documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <Tabs defaultValue="all" onValueChange={setSelectedTab}>
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>
        
        <TabsContent value={selectedTab}>
          <Card>
            <CardHeader>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>
                {selectedTab === "all" 
                  ? "All your uploaded documents" 
                  : `Your ${selectedTab} documents`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map(doc => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              {doc.type.includes("pdf") ? 
                                <FileText className="mr-2 h-5 w-5 text-red-500" /> : 
                                <FilePen className="mr-2 h-5 w-5 text-blue-500" />}
                              {doc.name}
                            </div>
                          </TableCell>
                          <TableCell>{doc.type}</TableCell>
                          <TableCell>{doc.size}</TableCell>
                          <TableCell>{new Date(doc.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs 
                              ${doc.status === 'processed' ? 'bg-green-100 text-green-800' : 
                                doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                doc.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'}`}>
                              {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDownload(doc.id)}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download</span>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <File className="h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-gray-500">No documents found</p>
                  {searchQuery && (
                    <p className="text-sm text-gray-400">
                      Try adjusting your search query
                    </p>
                  )}
                  <Button 
                    className="mt-4"
                    variant="outline"
                    onClick={handleUpload}
                  >
                    Upload a document
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <p className="text-sm text-gray-500">
                Showing {filteredDocuments.length} of {documents.length} documents
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}